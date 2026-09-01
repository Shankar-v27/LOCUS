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
  state: 'TRUSTED' | 'DEGRADED' | 'DENIED' | 'RECOVERING' | 'NETWORK';
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
  const confidence =
    typeof entry.confidence === 'number'
      ? entry.confidence
      : entry.state === 'TRUSTED'
      ? 0.98
      : entry.state === 'DENIED'
      ? 0.15
      : 0.65;

  const payload: LocusSyncPayload = {
    id: entry.id,
    deviceId: 'motorola-edge-50-fusion',
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: entry.timestamp || Date.now(),
    state: entry.state,
    confidence,
    reason: entry.reason,
    failedChecks: entry.failedChecks,
    explanation: entry.explanation,
    telemetry,
  };

  console.log(`[LOCUS SYNC] transition generated: ${entry.state} (id: ${entry.id})`);
  console.log(`[LOCUS SYNC] payload/device ID: ${payload.deviceId}`);

  const endpoints = customEndpoint ? [customEndpoint] : DEFAULT_OFFICE_KIT_ENDPOINTS;

  for (const endpoint of endpoints) {
    try {
      console.log(`[LOCUS SYNC] POST /api/events -> ${endpoint}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);
      console.log(`[LOCUS SYNC] POST response: ${res.status}`);
      if (res.ok) {
        return;
      }
    } catch (e: unknown) {
      console.log(`[LOCUS SYNC] POST failed for ${endpoint}:`, e instanceof Error ? e.message : String(e));
    }
  }
}
