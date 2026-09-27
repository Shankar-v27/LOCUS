import { useEffect, useState, useMemo } from 'react';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import {
  evaluateRuntimePolicy,
  type ProfileOverride,
  type RuntimePolicyDecision,
} from '@/services/adaptiveRuntimePolicy';

export function useAdaptiveRuntime() {
  const [override, setOverride] = useState<ProfileOverride>('AUTO');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fetch initial battery level if supported
    Battery.getBatteryLevelAsync()
      .then((level) => {
        if (!cancelled && typeof level === 'number' && level >= 0) {
          setBatteryLevel(level);
        }
      })
      .catch(() => {
        // Battery status unavailable (e.g. some emulators / restricted hardware)
        if (!cancelled) setBatteryLevel(null);
      });

    // Subscribe to battery changes
    const subscription = Battery.addBatteryLevelListener(({ batteryLevel: newLevel }) => {
      if (!cancelled && typeof newLevel === 'number' && newLevel >= 0) {
        setBatteryLevel(newLevel);
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  const totalMemoryBytes = Device.totalMemory ?? null;
  const deviceYearClass = Device.deviceYearClass ?? null;
  const isDevice = Device.isDevice ?? true;

  const decision: RuntimePolicyDecision = useMemo(() => {
    return evaluateRuntimePolicy({
      totalMemoryBytes,
      deviceYearClass,
      batteryLevel,
      isDevice,
      manualOverride: override,
    });
  }, [totalMemoryBytes, deviceYearClass, batteryLevel, isDevice, override]);

  return {
    decision,
    override,
    setOverride,
    totalMemoryBytes,
    batteryLevel,
  };
}
