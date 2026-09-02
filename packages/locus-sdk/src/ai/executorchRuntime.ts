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
}

let initialized = false;

/** Wires the Expo resource fetcher once; idempotent. */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  // Dynamic import is required: react-native-executorch installs JSI native
  // bindings at module import time, so a static import would crash every
  // environment without the native module (jest, plain Node) and would eager-
  // load at SDK import, defeating the lazy-startup guarantee.
  const [{ ExpoResourceFetcher }, executorch] = await Promise.all([
    import('react-native-executorch-expo-resource-fetcher'),
    import('react-native-executorch'),
  ]);
  executorch.initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialized = true;
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
  maxRetries = 2,
): Promise<T> {
  if (slot.promise) return slot.promise;

  slot.promise = queue
    .enqueue(async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await loadFn();
        } catch (error) {
          lastError = error;
          if (attempt <= maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          }
        }
      }
      throw lastError;
    })
    .catch((error: unknown) => {
      slot.promise = null;
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
  return cachedWithQueue(llmSlot, 'llm', async () => {
    await ensureInitialized();
    const executorch = await import('react-native-executorch');
    const instance = await executorch.LLMModule.fromModelName(
      executorch.models.llm.qwen3_0_6b(),
      (progress: number) => emitDownload('llm', { progress }),
    );
    emitDownload('llm', { progress: 1, ready: true });
    return instance;
  });
}

/** Whisper base.en (English-only, 16 kHz mono input). */
export function loadSpeechToText(): Promise<SpeechToTextModule> {
  return cachedWithQueue(sttSlot, 'speechToText', async () => {
    await ensureInitialized();
    const executorch = await import('react-native-executorch');
    const instance = await executorch.SpeechToTextModule.fromModelName(
      executorch.models.speech_to_text.whisper_base_en(),
      undefined,
      (progress: number) => emitDownload('speechToText', { progress }),
    );
    emitDownload('speechToText', { progress: 1, ready: true });
    return instance;
  });
}

/** all-mpnet-base-v2 pooled sentence embeddings (768-d). */
export function loadTextEmbeddings(): Promise<TextEmbeddingsModule> {
  return cachedWithQueue(embeddingsSlot, 'textEmbeddings', async () => {
    await ensureInitialized();
    const executorch = await import('react-native-executorch');
    const instance = await executorch.TextEmbeddingsModule.fromModelName(
      executorch.models.text_embedding.all_mpnet_base_v2(),
      (progress: number) => emitDownload('textEmbeddings', { progress }),
    );
    emitDownload('textEmbeddings', { progress: 1, ready: true });
    return instance;
  });
}

/** Pre-warm used by LocusProvider; loads models sequentially to prevent socket exhaustion. */
export function preloadModels(options: PreloadOptions = {}): void {
  const { llm = true, speechToText = true, textEmbeddings = true } = options;
  (async () => {
    if (llm) {
      try {
        await loadLlm();
      } catch {
        // Errors caught here so remaining models can preload; explicit calls will re-throw
      }
    }
    if (speechToText) {
      try {
        await loadSpeechToText();
      } catch {
        // Errors caught here
      }
    }
    if (textEmbeddings) {
      try {
        await loadTextEmbeddings();
      } catch {
        // Errors caught here
      }
    }
  })();
}
