import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { preloadModels, type PreloadOptions } from './executorchRuntime';

export type { PreloadOptions };

export interface LocusProviderProps extends PreloadOptions {
  /** Children are rendered untouched; the provider itself renders nothing. */
  children?: ReactNode;
}

/**
 * Headless preloader for the on-device AI stack. Mount it once near the app
 * root (e.g. around the expo-router Stack) to start downloading/loading the
 * LLM (Qwen3 0.6B quantized), speech-to-text (whisper-base.en) and text
 * embeddings (all-mpnet-base-v2) in the background while the app is used.
 *
 * It renders nothing and owns no state: the model instances land in the same
 * module-level caches that `createLocusSDK()` reads.
 */
export function LocusProvider({
  llm = true,
  speechToText = true,
  textEmbeddings = true,
  children,
}: LocusProviderProps): ReactNode {
  useEffect(() => {
    preloadModels({ llm, speechToText, textEmbeddings });
  }, [llm, speechToText, textEmbeddings]);

  return children ?? null;
}

/** Backwards-compatible aliases. */
export const AnchorProvider = LocusProvider;
export type AnchorProviderProps = LocusProviderProps;
