/**
 * LOCUS Mobile -> Office Kit Real-Time Event Broadcaster (Observer Path)
 *
 * Non-invasive event export bridge:
 *  - Dispatches authoritative on-device verdicts to the LOCUS Office Kit console.
 *  - 100% fire-and-forget: failure to reach Office Kit never affects local RAIM
 *    evaluation, latency budget, or on-device AI operations.
 */
import type { EventLogEntry } from '@/hooks/useAnchorPipeline';

export interface LocusSyncPayload {
  id: string | number;
  deviceId: string;
  deviceName: string;
  source: 'REAL_DEVICE';
  timestamp: number;
  state: 'TRUSTED' | 'DEGRADED' | 'DENIED' | 'RECOVERING';
  confidence: number;
  reason: string;
  failedChecks: string[];
  explanation: string | null;
  telemetry?: {
    latitude: number;
    longitude: number;
    altitudeMeters: number;
    speedMps: number;
    headingDeg: number;
    satellites: number;
    cn0Mean: number;
    hdop: number;
    baroPressureHpa?: number;
    isVpnActive?: boolean;
  };
}

const DEFAULT_OFFICE_KIT_ENDPOINTS = [
  'http://localhost:5173/api/events', // via ADB reverse tcp:5173 tcp:5173
  'http://10.0.2.2:5173/api/events', // Android Emulator host loopback
];

/**
 * Broadcast an authoritative LOCUS mobile event to the Office Kit console.
 * Silent on failure — never throws and never blocks the UI thread or state machine.
 */
export async function broadcastToOfficeKit(
  entry: EventLogEntry,
  telemetry?: LocusSyncPayload['telemetry'],
  customEndpoint?: string,
): Promise<void> {
  const payload: LocusSyncPayload = {
    id: entry.id,
    deviceId: 'motorola-edge-50-fusion',
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: entry.timestamp,
    state: entry.state,
    confidence: entry.state === 'TRUSTED' ? 0.98 : entry.state === 'DENIED' ? 0.15 : 0.55,
    reason: entry.reason,
    failedChecks: entry.failedChecks,
    explanation: entry.explanation,
    telemetry,
  };

  const endpoints = customEndpoint ? [customEndpoint] : DEFAULT_OFFICE_KIT_ENDPOINTS;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (res.ok) {
        // Successfully delivered to this endpoint
        return;
      }
    } catch {
      // Office Kit offline on this endpoint — try next or fail silently
    }
  }
}
