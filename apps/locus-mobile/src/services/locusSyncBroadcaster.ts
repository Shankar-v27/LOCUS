/**
 * LOCUS Mobile -> Office Kit Real-Time Event Broadcaster (Observer Path)
 *
 * Non-invasive event export bridge:
 *  - Dispatches authoritative on-device verdicts to the LOCUS Office Kit console.
 *  - 100% fire-and-forget: failure to reach Office Kit never affects local RAIM
 *    evaluation, latency budget, or on-device AI operations.
 */
import * as Device from 'expo-device';
import type { EventLogEntry } from '@/hooks/useLocusPipeline';

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
  isEnrichment?: boolean;
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

export const DEFAULT_OFFICE_KIT_ENDPOINTS = [
  'http://localhost:5173/api/events', // via ADB reverse tcp:5173 tcp:5173
  'http://10.0.2.2:5173/api/events', // Android Emulator host loopback
];

/**
 * Normalizes any configured host, IP, or URL string into a valid Office Kit `/api/events` endpoint.
 * Handles:
 *  - "192.168.1.50" -> "http://192.168.1.50:5173/api/events"
 *  - "192.168.1.50:5173" -> "http://192.168.1.50:5173/api/events"
 *  - "http://192.168.1.50:5173" -> "http://192.168.1.50:5173/api/events"
 *  - "http://192.168.1.50:5173/api/events" -> "http://192.168.1.50:5173/api/events"
 */
export function normalizeOfficeKitEndpoint(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  if (!hasProtocol) {
    // If no port specified and no path present, append default port 5173
    if (!trimmed.includes(':') && !trimmed.includes('/')) {
      trimmed = `${trimmed}:5173`;
    }
    trimmed = `http://${trimmed}`;
  }

  // Ensure trailing /api/events path
  if (!trimmed.endsWith('/api/events')) {
    if (trimmed.endsWith('/api')) {
      trimmed = `${trimmed}/events`;
    } else {
      trimmed = `${trimmed}/api/events`;
    }
  }

  return trimmed;
}

/**
 * Returns prioritized candidate endpoints for Office Kit event transmission.
 * Checks:
 *  1. Explicit runtime customEndpoint override (if provided)
 *  2. EXPO_PUBLIC_OFFICE_KIT_URL / EXPO_PUBLIC_OFFICE_KIT_HOST env vars (for physical device LAN Wi-Fi)
 *  3. Default dev endpoints (localhost via ADB reverse + 10.0.2.2 emulator loopback)
 */
export function getOfficeKitEndpoints(customEndpoint?: string): string[] {
  const endpoints: string[] = [];

  if (customEndpoint) {
    const normalized = normalizeOfficeKitEndpoint(customEndpoint);
    if (normalized) endpoints.push(normalized);
  }

  const envUrl = process.env.EXPO_PUBLIC_OFFICE_KIT_URL || process.env.EXPO_PUBLIC_OFFICE_KIT_HOST;
  if (envUrl) {
    const normalizedEnv = normalizeOfficeKitEndpoint(envUrl);
    if (normalizedEnv && !endpoints.includes(normalizedEnv)) {
      endpoints.push(normalizedEnv);
    }
  }

  for (const def of DEFAULT_OFFICE_KIT_ENDPOINTS) {
    if (!endpoints.includes(def)) {
      endpoints.push(def);
    }
  }

  return endpoints;
}

/**
 * Derives a normalized deviceId and human-readable deviceName from runtime hardware metadata.
 * Gracefully falls back if expo-device properties are null, empty, or unmocked.
 */
export function getDeviceIdentity(): { deviceId: string; deviceName: string } {
  try {
    const brand = (Device.brand || Device.manufacturer || '').trim();
    const model = (Device.modelName || Device.designName || Device.productName || '').trim();

    let rawName = '';
    if (brand && model) {
      rawName = model.toLowerCase().startsWith(brand.toLowerCase())
        ? model
        : `${brand} ${model}`;
    } else if (model) {
      rawName = model;
    } else if (brand) {
      rawName = brand;
    } else {
      rawName = 'Android Device';
    }

    // Normalize deviceId: e.g. "iQOO 15" -> "iqoo-15", "Pixel 8 Pro" -> "pixel-8-pro"
    const normalizedId =
      rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'field-node-01';

    const displayName = `FIELD-UNIT (${rawName})`;

    return { deviceId: normalizedId, deviceName: displayName };
  } catch {
    return { deviceId: 'field-node-01', deviceName: 'FIELD-UNIT (Android Device)' };
  }
}

/**
 * Broadcast an authoritative LOCUS mobile event to the Office Kit console.
 * Silent on failure — never throws and never blocks the UI thread or state machine.
 */
export async function broadcastToOfficeKit(
  entry: EventLogEntry,
  telemetry?: LocusSyncPayload['telemetry'],
  isEnrichment: boolean = false,
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

  const { deviceId, deviceName } = getDeviceIdentity();

  const payload: LocusSyncPayload = {
    id: entry.id,
    deviceId,
    deviceName,
    source: 'REAL_DEVICE',
    timestamp: entry.timestamp || Date.now(),
    state: entry.state,
    confidence,
    reason: entry.reason,
    failedChecks: entry.failedChecks,
    explanation: entry.explanation,
    isEnrichment,
    telemetry,
  };

  console.log(
    `[LOCUS SYNC OUT] eventId=${payload.id} state=${payload.state} timestamp=${payload.timestamp} confidence=${payload.confidence} reason=${payload.reason} failedChecks=${payload.failedChecks.join(',')} isEnrichment=${payload.isEnrichment}`,
  );

  const endpoints = getOfficeKitEndpoints(customEndpoint);

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
        return;
      }
    } catch (e: unknown) {
      // Non-blocking observer path
    }
  }
}

