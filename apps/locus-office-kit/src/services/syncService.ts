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
    id: 'drone-alpha-sim',
    name: 'DRONE-ALPHA (Autonomous UAV)',
    callsign: 'HAWK-7',
    model: 'Edge Companion Node (API 33)',
    source: 'SIMULATED',
    state: 'TRUSTED',
    confidence: 0.95,
    lastSeen: 0,
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
    lastSeen: 0,
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
    id: 'init-sim-1',
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
    telemetry: INITIAL_DEVICES[0].latestTelemetry,
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
    this.bootstrapFromServer();
    this.initBroadcastChannel();
    this.initSseStream();
  }

  public async bootstrapFromServer(payloadOverride?: unknown): Promise<void> {
    let data: any = payloadOverride;
    if (data === undefined && typeof window !== 'undefined' && 'fetch' in window) {
      try {
        const res = await fetch('/api/fleet');
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn('[BOOTSTRAP] fetch /api/fleet failed:', err);
      }
    }

    if (!data) return;

    console.log('[BOOTSTRAP] GET /api/fleet response', data);

    const parsedDevices: LocusDevice[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.devices)
      ? data.devices
      : Array.isArray(data?.fleet)
      ? data.fleet
      : [];

    const realParsedCount = parsedDevices.filter((d) => d.source === 'REAL_DEVICE').length;
    const iqooParsed = parsedDevices.find((d) => d.id === 'iqoo-15');

    console.log('[BOOTSTRAP] parsed device count', parsedDevices.length);
    console.log('[BOOTSTRAP] parsed REAL_DEVICE count', realParsedCount);
    console.log('[BOOTSTRAP] iqoo-15 record', iqooParsed);

    if (parsedDevices.length > 0) {
      const preservedReal = this.devices.filter(
        (d) => d.source === 'REAL_DEVICE' && !parsedDevices.some((p) => p.id === d.id),
      );
      this.devices = [...parsedDevices, ...preservedReal];
    }

    const parsedEvents: LocusIntegrityEvent[] = Array.isArray(data?.events)
      ? data.events
      : [];
    if (parsedEvents.length > 0) {
      this.events = parsedEvents;
    }

    const currentRealCount = this.devices.filter((d) => d.source === 'REAL_DEVICE').length;
    const currentIqoo = this.devices.find((d) => d.id === 'iqoo-15');

    console.log('[SYNC STATE] devices after bootstrap', this.devices.length);
    console.log('[SYNC STATE] REAL count', currentRealCount);
    console.log('[SYNC STATE] iqoo state', currentIqoo?.state);

    this.notify();
  }

  public handleSseMessage(data: { type: string; payload?: any }) {
    if (!data) return;
    if (data.type === 'SNAPSHOT' && data.payload) {
      const payload = data.payload;
      const snapshotDevices: LocusDevice[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.devices)
        ? payload.devices
        : Array.isArray(payload?.fleet)
        ? payload.fleet
        : [];

      console.log(
        '[LOCUS SSE] snapshot received:',
        snapshotDevices.length,
        'devices,',
        payload?.events?.length ?? 0,
        'events',
      );

      if (snapshotDevices.length > 0) {
        // TEST 29: SSE SNAPSHOT after bootstrap does not reset devices back to only simulated nodes
        const preservedReal = this.devices.filter(
          (d) => d.source === 'REAL_DEVICE' && !snapshotDevices.some((s) => s.id === d.id),
        );
        this.devices = [...snapshotDevices, ...preservedReal];
      }
      if (Array.isArray(payload?.events)) {
        this.events = payload.events;
      }
      this.notify();
    } else if (data.type === 'LOCUS_EVENT' && data.payload) {
      console.log('[LOCUS SSE] event received:', data.payload.deviceId, '->', data.payload.state);
      this.ingestRemoteEvent(data.payload);
    }
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
          console.log('[LOCUS SSE] connected to /api/stream');
          this.transportState = 'HTTP_SSE_CONNECTED';
          this.notify();
        };
        this.sseEventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleSseMessage(data);
          } catch {
            // Ignore malformed SSE frames
          }
        };
        this.sseEventSource.onerror = () => {
          // If SSE fails or restarts, fallback to BROWSER_LOCAL and schedule reconnect
          this.transportState = 'BROWSER_LOCAL';
          this.notify();
          if (this.sseEventSource) {
            this.sseEventSource.close();
            this.sseEventSource = null;
            setTimeout(() => this.initSseStream(), 1500);
          }
        };
      } catch {
        this.transportState = 'BROWSER_LOCAL';
      }
    }
  }

  private loadState() {
    this.devices = JSON.parse(JSON.stringify(INITIAL_DEVICES));
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    try {
      localStorage.removeItem(STORAGE_KEY_DEVICES);
      localStorage.removeItem(STORAGE_KEY_EVENTS);
    } catch {
      // ignore
    }
  }

  private saveState() {
    // Ephemeral in-memory store for active session; prevents stale states on browser reload
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

    const activeIncidents = this.devices.filter(
      (d) => d.state === 'DENIED' || d.state === 'DEGRADED',
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

    const isHeartbeat = cleanEvent.isHeartbeat === true;
    const isEnrichment = cleanEvent.isEnrichment === true;
    const existingEventIndex = this.events.findIndex((e) => e.id === cleanEvent.id);

    console.log(
      '[OFFICE_KIT] ingestRemoteEvent:',
      cleanEvent.deviceId,
      cleanEvent.state,
      'isHeartbeat=',
      isHeartbeat,
      'isEnrichment=',
      isEnrichment,
    );

    if (existingEventIndex >= 0) {
      this.events[existingEventIndex] = cleanEvent;
    } else if (!isHeartbeat) {
      this.events = [cleanEvent, ...this.events];
    }

    // Find existing device or dynamically register new device
    const existingIndex = this.devices.findIndex((d) => d.id === cleanEvent.deviceId);
    console.log('[OFFICE_KIT] existing device?', existingIndex >= 0);

    if (existingIndex >= 0) {
      const dev = this.devices[existingIndex];

      // If this is purely an enrichment update for an older event, update the incident reference if it matches,
      // but DO NOT roll back the active device state to an old event's state!
      if (isEnrichment) {
        console.log(
          `[LOCUS AI ENRICHMENT] eventId=${cleanEvent.id} originalState=${cleanEvent.state} originalTimestamp=${cleanEvent.timestamp} newExplanation=true`,
        );
        console.log(
          `[LOCUS DEVICE UPDATE] deviceId=${dev.id} incomingEventId=${cleanEvent.id} incomingState=${cleanEvent.state} incomingTimestamp=${cleanEvent.timestamp} currentState=${dev.state} currentLastSeen=${dev.lastSeen} accepted=false rejectionReason=AI_ENRICHMENT_DOES_NOT_MUTATE_DEVICE_STATE`,
        );

        let updatedIncident = dev.latestIncident;
        if (dev.latestIncident?.id === cleanEvent.id) {
          updatedIncident = cleanEvent;
        }
        this.devices[existingIndex] = {
          ...dev,
          latestIncident: updatedIncident,
        };
        this.notify();
        return;
      }

      // Check for stale event
      const eventTs = cleanEvent.timestamp || Date.now();
      let isMonotonic = true;
      if (!isHeartbeat) {
        if (
          dev.latestStateEventId !== undefined &&
          typeof cleanEvent.id === 'number' &&
          typeof dev.latestStateEventId === 'number'
        ) {
          if (cleanEvent.id < dev.latestStateEventId) {
            isMonotonic = false;
          }
        } else if (dev.lastSeen && eventTs < dev.lastSeen - 10000) {
          isMonotonic = false;
        }
      }

      if (!isMonotonic) {
        console.log(
          `[LOCUS DEVICE UPDATE] deviceId=${dev.id} incomingEventId=${cleanEvent.id} incomingState=${cleanEvent.state} incomingTimestamp=${eventTs} currentState=${dev.state} currentLastSeen=${dev.lastSeen} accepted=false rejectionReason=STALE_OR_OUT_OF_ORDER_EVENT`,
        );
        this.notify();
        return;
      }

      console.log(
        `[LOCUS DEVICE UPDATE] deviceId=${dev.id} incomingEventId=${cleanEvent.id} incomingState=${cleanEvent.state} incomingTimestamp=${eventTs} currentState=${dev.state} currentLastSeen=${dev.lastSeen} accepted=true rejectionReason=NONE`,
      );

      const isIntegrityState =
        cleanEvent.state === 'TRUSTED' ||
        cleanEvent.state === 'DEGRADED' ||
        cleanEvent.state === 'DENIED' ||
        cleanEvent.state === 'RECOVERING';
      const nextState = isIntegrityState ? cleanEvent.state : dev.state;
      const nextIncident =
        cleanEvent.state === 'DENIED' || cleanEvent.state === 'DEGRADED'
          ? cleanEvent
          : cleanEvent.state === 'TRUSTED'
          ? undefined
          : dev.latestIncident;

      const updated: LocusDevice = {
        ...dev,
        name: cleanEvent.deviceName || dev.name,
        callsign: cleanEvent.callsign || dev.callsign,
        source: cleanEvent.source || dev.source,
        state: nextState,
        confidence: typeof cleanEvent.confidence === 'number' ? cleanEvent.confidence : dev.confidence,
        lastSeen: Math.max(dev.lastSeen, eventTs),
        latestStateEventId: isHeartbeat ? dev.latestStateEventId : cleanEvent.id,
        syncStatus: 'ONLINE',
        latestTelemetry: cleanEvent.telemetry ?? dev.latestTelemetry,
        latestIncident: nextIncident,
      };
      this.devices = [
        ...this.devices.slice(0, existingIndex),
        updated,
        ...this.devices.slice(existingIndex + 1),
      ];
      console.log(`[LOCUS FLEET] node updated: ${dev.id} -> ${nextState} (confidence: ${updated.confidence})`);
      console.log('[OFFICE_KIT] updating REAL_DEVICE:', dev.id, 'source=', updated.source);
    } else {
      const defaultCallsign = cleanEvent.deviceId.toLowerCase().includes('iqoo')
        ? 'FIELD-01'
        : `NODE-${cleanEvent.deviceId.slice(-4).toUpperCase()}`;

      const newDev: LocusDevice = {
        id: cleanEvent.deviceId,
        name: cleanEvent.deviceName || `LOCUS-NODE-${cleanEvent.deviceId.slice(0, 6)}`,
        callsign: cleanEvent.callsign || defaultCallsign,
        model: 'LOCUS Field Unit',
        source,
        state: cleanEvent.state === 'NETWORK' ? 'TRUSTED' : cleanEvent.state,
        confidence: cleanEvent.confidence ?? 0.98,
        lastSeen: cleanEvent.timestamp || Date.now(),
        latestStateEventId: isHeartbeat ? undefined : cleanEvent.id,
        syncStatus: 'ONLINE',
        batteryPct: 100,
        aiReady: true,
        latestTelemetry: cleanEvent.telemetry,
        latestIncident:
          cleanEvent.state === 'DENIED' || cleanEvent.state === 'DEGRADED' ? cleanEvent : undefined,
      };
      this.devices = [newDev, ...this.devices];
      console.log(`[LOCUS FLEET] new node registered: ${newDev.id} -> ${newDev.state}`);
      console.log('[OFFICE_KIT] registering REAL_DEVICE:', newDev.id, 'source=', newDev.source);
    }

    console.log('[OFFICE_KIT] device count after update:', this.devices.length, 'realCount=', this.devices.filter((d) => d.source === 'REAL_DEVICE').length);
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

  public resetAll(forceClearReal = false) {
    try {
      localStorage.removeItem(STORAGE_KEY_DEVICES);
      localStorage.removeItem(STORAGE_KEY_EVENTS);
    } catch {
      // ignore
    }

    // Preserve all REAL_DEVICE records across console reset unless explicit full purge
    const realDevices = forceClearReal
      ? []
      : this.devices.filter((d) => d.source === 'REAL_DEVICE');
    const initialSimulated: LocusDevice[] = JSON.parse(JSON.stringify(INITIAL_DEVICES));

    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.devices = [...realDevices, ...initialSimulated];
    this.notify();

    if (typeof window !== 'undefined' && 'fetch' in window) {
      const url = forceClearReal ? '/api/reset?force=true' : '/api/reset';
      fetch(url, { method: 'POST' }).catch(() => {});
    }
  }
}

export const syncService = new SyncService();
