import type { CheckResult, SensorWindow } from '../types';
import { clamp01 } from './geo';

/** A forward interval larger than this (s) within a rolling window is a suspicious temporal gap. */
const MAX_GAP_S = 300;

/**
 * Temporal consistency of the fix timeline:
 * Timestamps must advance monotonically. Replayed timestamps (duplicates / frozen clock),
 * backwards timestamps (clock manipulation or out-of-order replay), and excessive forward
 * gaps (> 300s) are violations.
 *
 * Evaluated on `fixes`, the clock of record for the window.
 * - If fixes.length < 2: passes with score 1 (insufficient data to form an interval).
 * - Score: fraction of evaluated intervals that are healthy.
 * - passed = no violations.
 */
export function temporalCheck(window: SensorWindow): CheckResult {
  const fixes = window.fixes;
  if (fixes.length < 2) {
    return {
      id: 'temporal',
      passed: true,
      score: 1,
      detail: 'insufficient fixes (< 2) for temporal consistency',
    };
  }

  let intervals = 0;
  let violations = 0;
  let duplicates = 0;
  let backwards = 0;
  let gaps = 0;

  for (let i = 1; i < fixes.length; i += 1) {
    const aTs = fixes[i - 1].timestamp;
    const bTs = fixes[i].timestamp;
    if (!Number.isFinite(aTs) || !Number.isFinite(bTs) || aTs <= 0 || bTs <= 0) {
      intervals += 1;
      violations += 1;
      duplicates += 1;
      continue;
    }
    const dtSeconds = (bTs - aTs) / 1000;
    intervals += 1;
    if (!Number.isFinite(dtSeconds) || dtSeconds === 0) {
      duplicates += 1;
      violations += 1;
    } else if (dtSeconds < 0) {
      backwards += 1;
      violations += 1;
    } else if (dtSeconds > MAX_GAP_S) {
      gaps += 1;
      violations += 1;
    }
  }

  if (intervals === 0) {
    return {
      id: 'temporal',
      passed: true,
      score: 1,
      detail: 'no intervals to evaluate',
    };
  }

  const flags: string[] = [];
  if (duplicates > 0) flags.push(`${duplicates} duplicated timestamp(s)`);
  if (backwards > 0) flags.push(`${backwards} backwards timestamp(s)`);
  if (gaps > 0) flags.push(`${gaps} gap(s) > ${MAX_GAP_S}s`);

  return {
    id: 'temporal',
    passed: violations === 0,
    score: clamp01(1 - violations / intervals),
    detail:
      violations === 0
        ? `all ${intervals} intervals monotonic and valid`
        : flags.join(', '),
  };
}
