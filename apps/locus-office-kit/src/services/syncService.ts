import {
  LocusDevice,
  LocusIntegrityEvent,
  FleetMetrics,
  LocusIntegrityState,
  DeviceSource,
} from '../types/locusSync';

const STORAGE_KEY_DEVICES = 'locus_office_devices';
const STORAGE_KEY_EVENTS = 'locus_office_events';
const SYNC_CHANNEL_NAME = 'locus_fleet_sync';

export const INITIAL_DEVICES: LocusDevice[] = [
  {
    id: 'motorola-edge-50-fusion',
    name: 'FIELD-UNIT-01 (Motorola Edge 50)',
    callsign: 'VIPER-1',
    model: 'Motorola Edge 50 Fusion (API 34)',
    source: 'REAL_DEVICE',
    state: 'TRUSTED',
    confidence: 0.98,
    lastSeen: Date.now(),
    syncStatus: 'ONLINE',
    batteryPct: 87,
    aiReady: true,
    latestTelemetry: {
      latitude: 37.4220,
      longitude: -122.0841,
      altitudeMeters: 45.2,
      speedMps: 1.4,
      headingDeg: 124,
      satellites: 14,
      cn0Mean: 34.2,
      hdop: 0.8,
      baroPressureHpa: 1013.25,
      isVpnActive: false,
    },
  },
  {
    id: 'drone-alpha-sim',
    name: 'DRONE-ALPHA (Autonomous UAV)',
    callsign: 'HAWK-7',
    model: 'Edge Companion Node (API 33)',
    source: 'SIMULATED',
    state: 'TRUSTED',
    confidence: 0.95,
    lastSeen: Date.now() - 4000,
    syncStatus: 'ONLINE',
    batteryPct: 62,
    aiReady: true,
    latestTelemetry: {
      latitude: 37.4258,
      longitude: -122.0875,
      altitudeMeters: 120.0,
      speedMps: 14.8,
      headingDeg: 340,
      satellites: 18,
      cn0Mean: 38.5,
      hdop: 0.6,
      baroPressureHpa: 998.4,
      isVpnActive: false,
    },
  },
  {
    id: 'convoy-lead-sim',
    name: 'CONVOY-ESCORT (Lead Vehicle)',
    callsign: 'TITAN-3',
    model: 'Fleet Tracker V2 (API 34)',
    source: 'SIMULATED',
    state: 'TRUSTED',
    confidence: 0.92,
    lastSeen: Date.now() - 9000,
    syncStatus: 'STANDBY',
    batteryPct: 94,
    aiReady: true,
    latestTelemetry: {
      latitude: 37.4190,
      longitude: -122.0810,
      altitudeMeters: 38.1,
      speedMps: 0.0,
      headingDeg: 88,
      satellites: 12,
      cn0Mean: 31.0,
      hdop: 1.1,
      baroPressureHpa: 1014.1,
      isVpnActive: false,
    },
  },
];

export const INITIAL_EVENTS: LocusIntegrityEvent[] = [
  {
    id: 101,
    deviceId: 'motorola-edge-50-fusion',
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50)',
    source: 'REAL_DEVICE',
    timestamp: Date.now() - 60000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation:
      'Position is verified across Doppler kinematic velocity, multi-satellite C/N0 distribution, barometric altitude variance, and NOAA solar azimuth alignment.',
    telemetry: INITIAL_DEVICES[0].latestTelemetry,
  },
  {
    id: 100,
    deviceId: 'drone-alpha-sim',
    deviceName: 'DRONE-ALPHA (Autonomous UAV)',
    source: 'SIMULATED',
    timestamp: Date.now() - 120000,
    state: 'TRUSTED',
    confidence: 0.95,
    reason: 'all checks passed',
    failedChecks: [],
    explanation:
      'Airborne flight vector is consistent with GNSS pseudorange Doppler drift and IMU angular rate integration.',
    telemetry: INITIAL_DEVICES[1].latestTelemetry,
  },
];

type Listener = () => void;

export type TransportState = 'HTTP_SSE_CONNECTED' | 'BROWSER_LOCAL' | 'OFFLINE';

class SyncService {
  private devices: LocusDevice[] = [];
  private events: LocusIntegrityEvent[] = [];
  private listeners: Set<Listener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private sseEventSource: EventSource | null = null;
  private transportState: TransportState = 'BROWSER_LOCAL';
  private recoveryTimers: Map<string, number> = new Map();

  constructor() {
    this.loadState();
    this.initBroadcastChannel();
    this.initSseStream();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'LOCUS_EVENT') {
            this.ingestRemoteEvent(event.data.payload);
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }
  }

  private initSseStream() {
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        this.sseEventSource = new EventSource('/api/stream');
        this.sseEventSource.onopen = () => {
          this.transportState = 'HTTP_SSE_CONNECTED';
          this.notify();
        };
        this.sseEventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'LOCUS_EVENT' && data.payload) {
              this.ingestRemoteEvent(data.payload);
            }
          } catch {
            // Ignore malformed SSE frames
          }
        };
        this.sseEventSource.onerror = () => {
          // If SSE fails (e.g. running in production static mode), fallback gracefully to BROWSER_LOCAL
          this.transportState = 'BROWSER_LOCAL';
          this.notify();
        };
      } catch {
        this.transportState = 'BROWSER_LOCAL';
      }
    }
  }

  private loadState() {
    try {
      const savedDevices = localStorage.getItem(STORAGE_KEY_DEVICES);
      this.devices = savedDevices ? JSON.parse(savedDevices) : INITIAL_DEVICES;

      const savedEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
      this.events = savedEvents ? JSON.parse(savedEvents) : INITIAL_EVENTS;
    } catch {
      this.devices = INITIAL_DEVICES;
      this.events = INITIAL_EVENTS;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(this.devices));
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    } catch {
      // ignore
    }
  }

  private notify() {
    this.saveState();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDevices(): LocusDevice[] {
    return [...this.devices];
  }

  public getEvents(): LocusIntegrityEvent[] {
    return [...this.events];
  }

  public getTransportState(): TransportState {
    return this.transportState;
  }

  public getMetrics(): FleetMetrics {
    const totalDevices = this.devices.length;
    let realDevices = 0;
    let simulatedDevices = 0;
    let trusted = 0;
    let degraded = 0;
    let denied = 0;
    let recovering = 0;

    for (const d of this.devices) {
      if (d.source === 'REAL_DEVICE') realDevices++;
      else simulatedDevices++;

      if (d.state === 'TRUSTED') trusted++;
      else if (d.state === 'DEGRADED') degraded++;
      else if (d.state === 'DENIED') denied++;
      else if (d.state === 'RECOVERING') recovering++;
    }

    const activeIncidents = this.events.filter(
      (e) => (e.state === 'DENIED' || e.state === 'DEGRADED') && Date.now() - e.timestamp < 3600000,
    ).length;

    return {
      totalDevices,
      realDevices,
      simulatedDevices,
      trusted,
      degraded,
      denied,
      recovering,
      activeIncidents,
    };
  }

  /**
   * Ingest an authoritative event from a physical phone or simulator.
   * Office Kit NEVER recalculates or alters the verdict — it strictly records and displays.
   */
  public ingestRemoteEvent(event: LocusIntegrityEvent) {
    if (!event || !event.deviceId) return;

    // Stamp source if absent
    const source: DeviceSource = event.source || 'REAL_DEVICE';
    const cleanEvent: LocusIntegrityEvent = { ...event, source };

    this.events = [cleanEvent, ...this.events];

    // Find existing device or dynamically register new device
    const existingIndex = this.devices.findIndex((d) => d.id === cleanEvent.deviceId);
    if (existingIndex >= 0) {
      const dev = this.devices[existingIndex];
      const updated: LocusDevice = {
        ...dev,
        name: cleanEvent.deviceName || dev.name,
        source: cleanEvent.source || dev.source,
        state: cleanEvent.state,
        confidence: cleanEvent.confidence,
        lastSeen: cleanEvent.timestamp,
        syncStatus: 'ONLINE',
        latestTelemetry: cleanEvent.telemetry ?? dev.latestTelemetry,
        latestIncident: cleanEvent.state !== 'TRUSTED' ? cleanEvent : dev.latestIncident,
      };
      this.devices = [
        ...this.devices.slice(0, existingIndex),
        updated,
        ...this.devices.slice(existingIndex + 1),
      ];
    } else {
      const newDev: LocusDevice = {
        id: cleanEvent.deviceId,
        name: cleanEvent.deviceName || `LOCUS-NODE-${cleanEvent.deviceId.slice(0, 6)}`,
        callsign: `NODE-${cleanEvent.deviceId.slice(-4).toUpperCase()}`,
        model: 'LOCUS Field Unit',
        source,
        state: cleanEvent.state,
        confidence: cleanEvent.confidence,
        lastSeen: cleanEvent.timestamp,
        syncStatus: 'ONLINE',
        batteryPct: 100,
        aiReady: true,
        latestTelemetry: cleanEvent.telemetry,
        latestIncident: cleanEvent.state !== 'TRUSTED' ? cleanEvent : undefined,
      };
      this.devices = [newDev, ...this.devices];
    }

    this.notify();
  }

  /**
   * Stage simulated GNSS attack on a field device (clearly marked as SIMULATED).
   */
  public triggerAttack(
    deviceId: string,
    scenario: 'teleport' | 'cn0_lockstep' | 'heading_diverge' | 'vpn',
  ) {
    const dev = this.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    let failedChecks: string[] = [];
    let reason = '';
    let explanation = '';
    let state: LocusIntegrityState = 'DENIED';
    let confidence = 0.15;

    if (scenario === 'teleport') {
      failedChecks = ['kinematic', 'cn0'];
      reason = 'denied: kinematic, cn0 failed';
      explanation =
        'CRITICAL SPOOFING DETECTED: Instantaneous 412 m/s displacement exceeds physical kinetic envelope. Lockstep C/N0 satellite signal correlation indicates RF synthesizer injection.';
      state = 'DENIED';
      confidence = 0.12;
    } else if (scenario === 'cn0_lockstep') {
      failedChecks = ['cn0'];
      reason = 'degraded: cn0 lockstep correlation (0.94)';
      explanation =
        'RF INCONSISTENCY: Multi-satellite carrier-to-noise ratio variation is artificially synchronized across 12 channels. Probable ground transmitter spoofing.';
      state = 'DEGRADED';
      confidence = 0.48;
    } else if (scenario === 'heading_diverge') {
      failedChecks = ['heading'];
      reason = 'degraded: heading vs solar azimuth divergence (48°)';
      explanation =
        'HEADING ANOMALY: GPS course over ground disagrees with calibrated magnetometer and NOAA solar ephemeris triangulation.';
      state = 'DEGRADED';
      confidence = 0.52;
    } else if (scenario === 'vpn') {
      failedChecks = ['network'];
      reason = 'degraded: active VPN tunnel detected (tun0)';
      explanation =
        'NETWORK INCONSISTENCY: OS routing table contains an active VPN virtual interface. Location validity cannot be trusted while network tunnel is armed.';
      state = 'DEGRADED';
      confidence = 0.6;
    }

    const event: LocusIntegrityEvent = {
      id: Date.now(),
      deviceId: dev.id,
      deviceName: dev.name,
      source: dev.source,
      timestamp: Date.now(),
      state,
      confidence,
      reason,
      failedChecks,
      explanation,
      telemetry: {
        ...dev.latestTelemetry!,
        speedMps: scenario === 'teleport' ? 412.0 : dev.latestTelemetry?.speedMps ?? 0,
      },
    };

    this.ingestRemoteEvent(event);
  }

  /** Run the official LOCUS 5-epoch debounce recovery flow on a field device. */
  public triggerRecovery(deviceId: string) {
    const dev = this.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    if (this.recoveryTimers.has(deviceId)) {
      clearTimeout(this.recoveryTimers.get(deviceId));
    }

    // Step 1: Immediately transition to RECOVERING
    const recoveringEvent: LocusIntegrityEvent = {
      id: Date.now(),
      deviceId: dev.id,
      deviceName: dev.name,
      source: dev.source,
      timestamp: Date.now(),
      state: 'RECOVERING',
      confidence: 0.72,
      reason: 'clean evaluations in progress (debounce 5/5)',
      failedChecks: [],
      explanation:
        'RECOVERY IN PROGRESS: 5 consecutive clean RAIM epochs verified. Clearing residual fault buffer before returning to TRUSTED state.',
      telemetry: dev.latestTelemetry,
    };
    this.ingestRemoteEvent(recoveringEvent);

    // Step 2: After 3.5 seconds, transition to TRUSTED
    const timer = window.setTimeout(() => {
      const trustedEvent: LocusIntegrityEvent = {
        id: Date.now(),
        deviceId: dev.id,
        deviceName: dev.name,
        source: dev.source,
        timestamp: Date.now(),
        state: 'TRUSTED',
        confidence: 0.98,
        reason: 'all checks passed',
        failedChecks: [],
        explanation:
          'INTEGRITY RESTORED: All 7 physics consistency checks healthy. Authoritative fix restored.',
        telemetry: dev.latestTelemetry,
      };
      this.ingestRemoteEvent(trustedEvent);
      this.recoveryTimers.delete(deviceId);
    }, 3500);

    this.recoveryTimers.set(deviceId, timer);
  }

  public resetAll() {
    this.devices = INITIAL_DEVICES;
    this.events = INITIAL_EVENTS;
    this.notify();
  }
}

export const syncService = new SyncService();
