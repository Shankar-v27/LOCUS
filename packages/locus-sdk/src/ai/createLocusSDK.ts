import type { LocusSDK, IntegrityState, SensorWindow, Verdict } from '../types';
import { RECOVERY_DEBOUNCE, stepIntegrity, type IntegrityMachine } from '../evaluateIntegrity';
import { explainVerdict } from './explainVerdict';
import { transcribeCommand } from './transcribeCommand';
import { embedText } from './embedText';

/**
 * Creates the public LocusSDK instance.
 *
 * The returned object owns ONE safety state machine: `evaluate` advances an
 * internal `IntegrityMachine` (via the pure `stepIntegrity`), so the
 * RECOVERY_DEBOUNCE counting is handled for the caller. The optional
 * `prevState` argument is honored only before the first evaluation of this
 * instance; afterwards the internal machine is authoritative.
 *
 * AI methods (explain/transcribe/embed) load their models lazily on first
 * call and never touch the state machine: `LocusSDK` exposes no mutation
 * path, which is the type-level guarantee that AI cannot alter state.
 */
export function createLocusSDK(): LocusSDK {
  let machine: IntegrityMachine | undefined;

  return {
    evaluate(window: SensorWindow, prevState?: IntegrityState): Verdict {
      if (!machine && prevState) {
        machine = {
          state: prevState,
          cleanStreak: prevState === 'RECOVERING' ? RECOVERY_DEBOUNCE : 0,
        };
      }
      const step = stepIntegrity(window, machine);
      machine = step.machine;
      return step.verdict;
    },

    explain(verdict: Verdict): Promise<string> {
      return explainVerdict(verdict);
    },

    transcribe(audio: Float32Array): Promise<string> {
      return transcribeCommand(audio);
    },

    embed(text: string): Promise<number[]> {
      return embedText(text);
    },
  };
}

/** Backwards-compatible alias. */
export const createAnchorSDK = createLocusSDK;
