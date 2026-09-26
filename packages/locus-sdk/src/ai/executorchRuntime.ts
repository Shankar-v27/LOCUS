/**
 * Shared lazy runtime for the ExecuTorch-backed AI wrappers.
 *
 * Architecture notes:
 *  - The functional module API of react-native-executorch (LLMModule /
 *    SpeechToTextModule / TextEmbeddingsModule `fromModelName`) is preferred
 *    over hooks: model instances live in module-level promise caches, so
 *    nothing loads at startup and each wrapper loads only what it needs on
 *    first call.
 *  - react-native-executorch's index installs JSI bindings at import time,
 *    so the package is imported dynamically (never at module scope) and
 *    `tsc`/jest environments without the native module stay clean.
 *  - LocusProvider pre-warms the SAME caches, so a mounted provider and
 *    createLocusSDK() share one loaded model per task instead of two.
 *  - Model downloads surface real progress (fraction 0..1 straight from the
 *    resource fetcher) through subscribeModelDownloads — the UI renders this;
 *    nothing is simulated.
 *  - Cache Invalidation & Diagnostics: Detailed logging at each lifecycle stage
 *    (enqueue, download start/progress/complete, cache hit/miss, init start/success/error)
 *    with automatic cache cleanup upon corrupted resource load failures.
 */

import type {
  LLMModule,
  SpeechToTextModule,
  TextEmbeddingsModule,
} from 'react-native-executorch';

export interface PreloadOptions {
  llm?: boolean;
  speechToText?: boolean;
  textEmbeddings?: boolean;
}

/** The three lazily-loaded model tasks, keyed for download progress. */
export type ModelTask = 'llm' | 'speechToText' | 'textEmbeddings';

export interface ModelDownloadState {
  /** 0..1 real fetcher progress; 1 = fully downloaded (cached loads skip to 1). */
  progress: number;
  /** True once the model is loaded and callable. */
  ready: boolean;
  /** Error message if loading/downloading failed. */
  error?: string | null;
}

let initialized = false;

function aiLog(message: string): void {
  console.log(`[LOCUS AI] ${message}`);
}

function aiError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.error(`[LOCUS AI ERROR] ${message} -> ${error.name}: ${error.message}\n${error.stack || ''}`);
  } else {
    console.error(`[LOCUS AI ERROR] ${message} -> ${String(error)}`);
  }
}

/** Wires the Expo resource fetcher once; idempotent. */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  // Dynamic import is required: react-native-executorch installs JSI native
  // bindings at module import time, so a static import would crash every
  // environment without the native module (jest, plain Node) and would eager-
  // load at SDK import, defeating the lazy-startup guarantee.
  aiLog('Initializing ExecuTorch runtime with ExpoResourceFetcher...');
  const [{ ExpoResourceFetcher }, executorch] = await Promise.all([
    import('react-native-executorch-expo-resource-fetcher'),
    import('react-native-executorch'),
  ]);
  executorch.initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialized = true;
  aiLog('ExecuTorch runtime initialized successfully.');
}

/** Invalidate cached files for given resource sources if a model load fails due to file corruption. */
async function invalidateSources(sources: Array<string | undefined | null>): Promise<void> {
  try {
    const validSources = sources.filter((s): s is string => typeof s === 'string' && s.length > 0);
    if (validSources.length === 0) return;
    const { ExpoResourceFetcher } = await import('react-native-executorch-expo-resource-fetcher');
    aiLog(`Invalidating potential corrupt cache files for sources: ${validSources.join(', ')}`);
    await ExpoResourceFetcher.deleteResources(...validSources);
    aiLog('Corrupt cache invalidation complete.');
  } catch (err) {
    aiError('Failed to invalidate cache sources', err);
  }
}

// --- Serialized Download Queue & Retry ---------------------------------------

class DownloadQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => fn());
    this.tail = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}

const queue = new DownloadQueue();

function cachedWithQueue<T>(
  slot: { promise: Promise<T> | null },
  task: ModelTask,
  loadFn: () => Promise<T>,
  cleanupSources: () => Array<string | undefined | null>,
  maxRetries = 2,
): Promise<T> {
  if (slot.promise) {
    aiLog(`Task '${task}' already requested; returning cached promise.`);
    return slot.promise;
  }

  aiLog(`Enqueuing model task '${task}' in download/load queue.`);
  slot.promise = queue
    .enqueue(async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          aiLog(`Task '${task}' starting execution (attempt ${attempt}/${maxRetries + 1})...`);
          const result = await loadFn();
          aiLog(`Task '${task}' succeeded on attempt ${attempt}.`);
          return result;
        } catch (error) {
          lastError = error;
          aiError(`Task '${task}' failed on attempt ${attempt}/${maxRetries + 1}`, error);
          // Invalidate cache before retry to clear corrupted downloads
          await invalidateSources(cleanupSources());
          if (attempt <= maxRetries) {
            const backoffMs = 1500 * attempt;
            aiLog(`Task '${task}' retrying in ${backoffMs} ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }
      throw lastError;
    })
    .catch((error: unknown) => {
      slot.promise = null;
      emitDownload(task, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    });

  return slot.promise;
}

// --- Real download-progress registry ----------------------------------------

const downloadStates = new Map<ModelTask, ModelDownloadState>();
const downloadListeners = new Set<(states: Record<ModelTask, ModelDownloadState>) => void>();

function emitDownload(task: ModelTask, patch: Partial<ModelDownloadState>): void {
  const current = downloadStates.get(task) ?? { progress: 0, ready: false };
  const next = { ...current, ...patch };
  downloadStates.set(task, next);
  const snapshot = {
    llm: downloadStates.get('llm') ?? { progress: 0, ready: false },
    speechToText: downloadStates.get('speechToText') ?? { progress: 0, ready: false },
    textEmbeddings: downloadStates.get('textEmbeddings') ?? { progress: 0, ready: false },
  };
  for (const listener of downloadListeners) listener(snapshot);
}

/** Subscribe to real model-download progress (fraction + ready flag per task). */
export function subscribeModelDownloads(
  listener: (states: Record<ModelTask, ModelDownloadState>) => void,
): () => void {
  downloadListeners.add(listener);
  return () => {
    downloadListeners.delete(listener);
  };
}

/** Latest known download state per task (no subscription). */
export function getModelDownloadStates(): Record<ModelTask, ModelDownloadState> {
  return {
    llm: downloadStates.get('llm') ?? { progress: 0, ready: false },
    speechToText: downloadStates.get('speechToText') ?? { progress: 0, ready: false },
    textEmbeddings: downloadStates.get('textEmbeddings') ?? { progress: 0, ready: false },
  };
}

const llmSlot: { promise: Promise<LLMModule> | null } = { promise: null };
const sttSlot: { promise: Promise<SpeechToTextModule> | null } = { promise: null };
const embeddingsSlot: { promise: Promise<TextEmbeddingsModule> | null } = { promise: null };

/**
 * Qwen3 0.6B, 8da4w-quantized (registry default variant). Chosen over the
 * 1.7B model for the advisory latency budget: same tokenizer/chat template,
 * ~3x fewer parameters, so prefill + short decode fits the sub-300 ms window
 * the demo requires while keeping the accuracy the constrained prompt needs.
 */
export function loadLlm(): Promise<LLMModule> {
  let modelConfig: any = null;
  return cachedWithQueue(
    llmSlot,
    'llm',
    async () => {
      await ensureInitialized();
      const executorch = await import('react-native-executorch');
      modelConfig = executorch.models.llm.qwen3_0_6b();
      aiLog(`Loading LLM '${modelConfig.modelName}' from ${modelConfig.modelSource}...`);
      const instance = await executorch.LLMModule.fromModelName(
        modelConfig,
        (progress: number) => {
          aiLog(`LLM download progress: ${(progress * 100).toFixed(1)}%`);
          emitDownload('llm', { progress, error: null });
        },
      );
      aiLog(`LLM '${modelConfig.modelName}' initialized and ready.`);
      emitDownload('llm', { progress: 1, ready: true, error: null });
      return instance;
    },
    () => [modelConfig?.modelSource, modelConfig?.tokenizerSource, modelConfig?.tokenizerConfigSource],
  );
}

/** Whisper base.en (English-only, 16 kHz mono input). */
export function loadSpeechToText(): Promise<SpeechToTextModule> {
  let modelConfig: any = null;
  return cachedWithQueue(
    sttSlot,
    'speechToText',
    async () => {
      await ensureInitialized();
      const executorch = await import('react-native-executorch');
      modelConfig = executorch.models.speech_to_text.whisper_base_en();
      aiLog(`Loading STT '${modelConfig.modelName}' from ${modelConfig.modelSource}...`);
      const instance = await executorch.SpeechToTextModule.fromModelName(
        modelConfig,
        undefined,
        (progress: number) => {
          aiLog(`STT download progress: ${(progress * 100).toFixed(1)}%`);
          emitDownload('speechToText', { progress, error: null });
        },
      );
      aiLog(`STT '${modelConfig.modelName}' initialized and ready.`);
      emitDownload('speechToText', { progress: 1, ready: true, error: null });
      return instance;
    },
    () => [modelConfig?.modelSource, modelConfig?.tokenizerSource],
  );
}

/** all-mpnet-base-v2 pooled sentence embeddings (768-d). */
export function loadTextEmbeddings(): Promise<TextEmbeddingsModule> {
  let modelConfig: any = null;
  return cachedWithQueue(
    embeddingsSlot,
    'textEmbeddings',
    async () => {
      await ensureInitialized();
      const executorch = await import('react-native-executorch');
      modelConfig = executorch.models.text_embedding.all_mpnet_base_v2();
      aiLog(`Loading Embeddings '${modelConfig.modelName}' from ${modelConfig.modelSource}...`);
      const instance = await executorch.TextEmbeddingsModule.fromModelName(
        modelConfig,
        (progress: number) => {
          aiLog(`Embeddings download progress: ${(progress * 100).toFixed(1)}%`);
          emitDownload('textEmbeddings', { progress, error: null });
        },
      );
      aiLog(`Embeddings '${modelConfig.modelName}' initialized and ready.`);
      emitDownload('textEmbeddings', { progress: 1, ready: true, error: null });
      return instance;
    },
    () => [modelConfig?.modelSource, modelConfig?.tokenizerSource],
  );
}

/** Pre-warm used by LocusProvider; loads models sequentially to prevent socket exhaustion. */
export function preloadModels(options: PreloadOptions = {}): void {
  const { llm = true, speechToText = true, textEmbeddings = true } = options;
  aiLog(`Starting preload sequence (llm=${llm}, speechToText=${speechToText}, textEmbeddings=${textEmbeddings})`);
  (async () => {
    if (llm) {
      try {
        await loadLlm();
      } catch (err) {
        aiError('Preload for LLM failed; continuing with remaining models', err);
      }
    }
    if (speechToText) {
      try {
        await loadSpeechToText();
      } catch (err) {
        aiError('Preload for STT failed; continuing with remaining models', err);
      }
    }
    if (textEmbeddings) {
      try {
        await loadTextEmbeddings();
      } catch (err) {
        aiError('Preload for TextEmbeddings failed', err);
      }
    }
    aiLog('Preload sequence completed.');
  })();
}
