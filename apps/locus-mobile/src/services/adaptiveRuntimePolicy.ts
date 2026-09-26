/**
 * LOCUS Adaptive Edge Runtime Policy Engine
 *
 * Deterministic policy layer that balances device capability, battery condition,
 * and thermal constraints against optional AI workloads.
 *
 * INVARIANT:
 * The deterministic integrity path (GNSS fixes, C/N0 distribution, 7 physics
 * consistency checks, RAIM/FDE state machine) is ALWAYS ON regardless of profile.
 * AI models and automated advisory generation are optional workloads that adapt.
 */

export type RuntimeProfile = 'HIGH_PERFORMANCE' | 'BALANCED' | 'LOW_POWER';
export type ProfileOverride = RuntimeProfile | 'AUTO';

/** Memory thresholds in bytes */
export const MEMORY_HIGH_BYTES = 8 * 1024 * 1024 * 1024; // >= 8 GB
export const MEMORY_BALANCED_BYTES = 4 * 1024 * 1024 * 1024; // >= 4 GB and < 8 GB

/** Battery thresholds (fraction 0..1) */
export const BATTERY_BALANCED_THRESHOLD = 0.5; // < 50% prefers BALANCED
export const BATTERY_LOW_THRESHOLD = 0.2; // < 20% prefers LOW_POWER

export interface RuntimeInputs {
  /** Total device RAM in bytes (from Device.totalMemory or null if unavailable). */
  totalMemoryBytes: number | null;
  /** Estimated device year class (e.g. 2024, 2020) or null. */
  deviceYearClass?: number | null;
  /** Battery fraction (0.0 to 1.0) or null if unavailable. */
  batteryLevel?: number | null;
  /** Physical device vs simulator. */
  isDevice?: boolean;
  /** Manual demo/developer override. */
  manualOverride?: ProfileOverride;
}

export interface RuntimePolicyDecision {
  /** Active selected profile. */
  profile: RuntimeProfile;
  /** Preload AI models at startup (true ONLY in HIGH_PERFORMANCE). */
  preloadAI: boolean;
  /** Automatically run Qwen on state transitions (false in BALANCED & LOW_POWER; on-demand only). */
  autoEnrichAdvisory: boolean;
  /** Deterministic integrity path is ALWAYS ON across all profiles. */
  integrityMode: 'ALWAYS_ON';
  /** Normalized battery level fraction (0..1) or null if unavailable. */
  batteryLevel: number | null;
  /** Normalized total RAM in bytes or null if unavailable. */
  totalMemoryBytes: number | null;
  /** Descriptive explanation for the selected profile. */
  reason: string;
}

/**
 * Pure decision engine: maps runtime device capability and battery state to an adaptive workload policy.
 * No React dependencies, no side effects, no model loading.
 */
export function evaluateRuntimePolicy(inputs: RuntimeInputs): RuntimePolicyDecision {
  const {
    totalMemoryBytes = null,
    batteryLevel = null,
    manualOverride = 'AUTO',
  } = inputs;

  const validBattery =
    typeof batteryLevel === 'number' && Number.isFinite(batteryLevel) && batteryLevel >= 0 && batteryLevel <= 1
      ? batteryLevel
      : null;

  const validMemory =
    typeof totalMemoryBytes === 'number' && Number.isFinite(totalMemoryBytes) && totalMemoryBytes > 0
      ? totalMemoryBytes
      : null;

  // 1. Manual Demo Override (strictly modulates AI policy, never alters integrity checks)
  if (manualOverride && manualOverride !== 'AUTO') {
    return buildDecision(
      manualOverride,
      validMemory,
      validBattery,
      `Manual demo override selected: ${manualOverride}`,
    );
  }

  // 2. Hardware Capability Baseline
  let capabilityProfile: RuntimeProfile = 'BALANCED';
  let capabilityReason = '';

  if (validMemory !== null) {
    if (validMemory >= MEMORY_HIGH_BYTES) {
      capabilityProfile = 'HIGH_PERFORMANCE';
      capabilityReason = `High memory capability (${formatBytesToGb(validMemory)})`;
    } else if (validMemory >= MEMORY_BALANCED_BYTES) {
      capabilityProfile = 'BALANCED';
      capabilityReason = `Moderate memory capability (${formatBytesToGb(validMemory)})`;
    } else {
      capabilityProfile = 'LOW_POWER';
      capabilityReason = `Constrained memory capability (${formatBytesToGb(validMemory)})`;
    }
  } else {
    // Safe default when memory metadata is unavailable
    capabilityProfile = 'BALANCED';
    capabilityReason = 'Device memory class unavailable; using standard baseline';
  }

  // 3. Battery Degradation Policy (selects the more conservative profile)
  let finalProfile = capabilityProfile;
  let finalReason = capabilityReason;

  if (validBattery !== null) {
    const batteryPct = Math.round(validBattery * 100);
    if (validBattery < BATTERY_LOW_THRESHOLD) {
      if (finalProfile !== 'LOW_POWER') {
        finalProfile = 'LOW_POWER';
        finalReason = `Low battery (${batteryPct}% < 20%); switched to low-power profile`;
      } else {
        finalReason += ` · Low battery (${batteryPct}%)`;
      }
    } else if (validBattery < BATTERY_BALANCED_THRESHOLD) {
      if (finalProfile === 'HIGH_PERFORMANCE') {
        finalProfile = 'BALANCED';
        finalReason = `Moderate battery (${batteryPct}% < 50%); scaled from high-performance to balanced`;
      } else {
        finalReason += ` · Battery (${batteryPct}%)`;
      }
    } else {
      finalReason += ` · Healthy battery (${batteryPct}%)`;
    }
  }

  return buildDecision(finalProfile, validMemory, validBattery, finalReason);
}

function buildDecision(
  profile: RuntimeProfile,
  memory: number | null,
  battery: number | null,
  reason: string,
): RuntimePolicyDecision {
  const isHigh = profile === 'HIGH_PERFORMANCE';
  const isBalanced = profile === 'BALANCED';

  return {
    profile,
    preloadAI: isHigh,
    autoEnrichAdvisory: isHigh,
    integrityMode: 'ALWAYS_ON',
    batteryLevel: battery,
    totalMemoryBytes: memory,
    reason,
  };
}

/** Formats byte counts into human-readable GB strings (e.g. 16106127360 -> "15.0 GB"). */
export function formatBytesToGb(bytes: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return 'N/A';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

/** Formats battery fractions into percentage strings (e.g. 0.83 -> "83%"). */
export function formatBatteryPct(level: number | null): string {
  if (level === null || level === undefined || !Number.isFinite(level)) {
    return 'N/A';
  }
  return `${Math.round(level * 100)}%`;
}
