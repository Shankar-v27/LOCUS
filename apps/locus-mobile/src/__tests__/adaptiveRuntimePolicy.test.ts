import {
  evaluateRuntimePolicy,
  formatBytesToGb,
  formatBatteryPct,
  MEMORY_HIGH_BYTES,
  MEMORY_BALANCED_BYTES,
} from '../services/adaptiveRuntimePolicy';

describe('LOCUS Adaptive Runtime Policy Engine', () => {
  const GB = 1024 * 1024 * 1024;

  describe('Device Capability (Memory) Classification', () => {
    it('selects HIGH_PERFORMANCE for high-memory devices (>= 8 GB) with healthy battery', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 15.1 * GB, // e.g. iQOO 15 (16GB class)
        batteryLevel: 0.85,
        isDevice: true,
      });

      expect(decision.profile).toBe('HIGH_PERFORMANCE');
      expect(decision.preloadAI).toBe(true);
      expect(decision.autoEnrichAdvisory).toBe(true);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('High memory capability');
    });

    it('selects BALANCED for mid-memory devices (4 GB to 8 GB) with healthy battery', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 6 * GB,
        batteryLevel: 0.75,
        isDevice: true,
      });

      expect(decision.profile).toBe('BALANCED');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Moderate memory capability');
    });

    it('selects LOW_POWER for low-memory devices (< 4 GB) regardless of healthy battery', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 3 * GB,
        batteryLevel: 0.95,
        isDevice: true,
      });

      expect(decision.profile).toBe('LOW_POWER');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Constrained memory capability');
    });
  });

  describe('Battery Degradation Policy', () => {
    it('downgrades HIGH_PERFORMANCE device to BALANCED when battery is between 20% and 49%', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 12 * GB,
        batteryLevel: 0.35, // 35%
        isDevice: true,
      });

      expect(decision.profile).toBe('BALANCED');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Moderate battery (35% < 50%)');
    });

    it('downgrades HIGH_PERFORMANCE device to LOW_POWER when battery is below 20%', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 16 * GB,
        batteryLevel: 0.12, // 12%
        isDevice: true,
      });

      expect(decision.profile).toBe('LOW_POWER');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Low battery (12% < 20%)');
    });

    it('downgrades BALANCED device to LOW_POWER when battery is below 20%', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 6 * GB,
        batteryLevel: 0.15,
        isDevice: true,
      });

      expect(decision.profile).toBe('LOW_POWER');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Low battery (15% < 20%)');
    });

    it('keeps LOW_POWER on low-memory device when battery is low', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 2 * GB,
        batteryLevel: 0.1,
        isDevice: true,
      });

      expect(decision.profile).toBe('LOW_POWER');
      expect(decision.preloadAI).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
    });
  });

  describe('Missing Metadata & Safe Fallbacks', () => {
    it('falls back to memory capability when battery is unavailable (null)', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 8 * GB,
        batteryLevel: null,
      });

      expect(decision.profile).toBe('HIGH_PERFORMANCE');
      expect(decision.preloadAI).toBe(true);
      expect(decision.batteryLevel).toBeNull();
      expect(decision.integrityMode).toBe('ALWAYS_ON');
    });

    it('falls back to BALANCED when device memory is null', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: null,
        batteryLevel: null,
      });

      expect(decision.profile).toBe('BALANCED');
      expect(decision.preloadAI).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Device memory class unavailable');
    });
  });

  describe('Developer / Demo Manual Overrides', () => {
    it('forces LOW_POWER on high-capability device when manual override is active', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 16 * GB,
        batteryLevel: 0.99,
        manualOverride: 'LOW_POWER',
      });

      expect(decision.profile).toBe('LOW_POWER');
      expect(decision.preloadAI).toBe(false);
      expect(decision.autoEnrichAdvisory).toBe(false);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
      expect(decision.reason).toContain('Manual demo override selected: LOW_POWER');
    });

    it('forces HIGH_PERFORMANCE when manual override is active', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 2 * GB,
        batteryLevel: 0.1,
        manualOverride: 'HIGH_PERFORMANCE',
      });

      expect(decision.profile).toBe('HIGH_PERFORMANCE');
      expect(decision.preloadAI).toBe(true);
      expect(decision.autoEnrichAdvisory).toBe(true);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
    });

    it('uses automatic evaluation when override is AUTO', () => {
      const decision = evaluateRuntimePolicy({
        totalMemoryBytes: 8 * GB,
        batteryLevel: 0.8,
        manualOverride: 'AUTO',
      });

      expect(decision.profile).toBe('HIGH_PERFORMANCE');
      expect(decision.preloadAI).toBe(true);
    });
  });

  describe('Safety Invariant: Integrity Engine is ALWAYS ON', () => {
    const testCases: Array<Parameters<typeof evaluateRuntimePolicy>[0]> = [
      { totalMemoryBytes: 16 * GB, batteryLevel: 1.0 },
      { totalMemoryBytes: 8 * GB, batteryLevel: 0.5 },
      { totalMemoryBytes: 6 * GB, batteryLevel: 0.8 },
      { totalMemoryBytes: 2 * GB, batteryLevel: 0.9 },
      { totalMemoryBytes: 16 * GB, batteryLevel: 0.05 },
      { totalMemoryBytes: null, batteryLevel: null },
      { totalMemoryBytes: 16 * GB, manualOverride: 'LOW_POWER' },
      { totalMemoryBytes: 2 * GB, manualOverride: 'HIGH_PERFORMANCE' },
      { totalMemoryBytes: 4 * GB, manualOverride: 'BALANCED' },
    ];

    it.each(testCases)('always produces integrityMode === ALWAYS_ON for %p', (input) => {
      const decision = evaluateRuntimePolicy(input);
      expect(decision.integrityMode).toBe('ALWAYS_ON');
    });
  });

  describe('Formatting Helpers', () => {
    it('formats byte numbers to GB strings', () => {
      expect(formatBytesToGb(16 * GB)).toBe('16.0 GB');
      expect(formatBytesToGb(7.5 * GB)).toBe('7.5 GB');
      expect(formatBytesToGb(null)).toBe('N/A');
    });

    it('formats battery levels to percentage strings', () => {
      expect(formatBatteryPct(0.83)).toBe('83%');
      expect(formatBatteryPct(0.05)).toBe('5%');
      expect(formatBatteryPct(null)).toBe('N/A');
    });
  });
});
