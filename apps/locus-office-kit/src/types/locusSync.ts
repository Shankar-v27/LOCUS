/**
 * Shared LOCUS Sync & Fleet Data Contract
 * Integration model between authoritative LOCUS mobile devices and the LOCUS Office Kit.
 */

export type LocusIntegrityState = 'TRUSTED' | 'DEGRADED' | 'DENIED' | 'RECOVERING' | 'NETWORK';

export type DeviceSource = 'REAL_DEVICE' | 'SIMULATED';

export type CheckId = 'kinematic' | 'heading' | 'temporal' | 'altitude' | 'environmental' | 'cn0' | 'network';

export interface CheckResultSummary {
  id: CheckId;
  name: string;
  passed: boolean;
  score: number;
  detail: string;
}

export interface TelemetrySnapshot {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  speedMps: number;
  headingDeg: number;
  satellites: number;
  cn0Mean: number;
  baroPressureHpa?: number;
  hdop: number;
  isVpnActive?: boolean;
}

export interface LocusIntegrityEvent {
  id: string | number;
  deviceId: string;
  deviceName: string;
  source: DeviceSource;
  timestamp: number;
  state: LocusIntegrityState;
  confidence: number;
  reason: string;
  failedChecks: string[];
  explanation: string | null;
  embedding?: number[] | null;
  telemetry?: TelemetrySnapshot;
  checks?: CheckResultSummary[];
}

export interface LocusDevice {
  id: string;
  name: string;
  callsign: string;
  model: string;
  source: DeviceSource;
  state: LocusIntegrityState;
  confidence: number;
  lastSeen: number;
  syncStatus: 'ONLINE' | 'STANDBY' | 'OFFLINE';
  batteryPct: number;
  aiReady: boolean;
  latestTelemetry?: TelemetrySnapshot;
  latestIncident?: LocusIntegrityEvent;
}

export interface FleetMetrics {
  totalDevices: number;
  realDevices: number;
  simulatedDevices: number;
  trusted: number;
  degraded: number;
  denied: number;
  recovering: number;
  activeIncidents: number;
}
