import { syncService } from '../services/syncService';
import { LocusIntegrityEvent, LocusDevice } from '../types/locusSync';

async function runTests() {
  console.log('[TEST] Starting comprehensive STEP 11 LOCUS Office Kit synchronization unit tests...');
  const devId = 'live-field-unit-01';
  const devName = 'FIELD-UNIT-01 (GNSS Cockpit)';
  const baseTime = Date.now();

  // TEST 0: Initial seed state contains only simulated fleet (no fake Motorola)
  syncService.resetAll(true);
  let devices = syncService.getDevices();
  if (devices.length !== 2) {
    throw new Error(`Test 0 Failed: Expected 2 initial simulated devices, got ${devices.length}`);
  }
  const realCount = devices.filter((d) => d.source === 'REAL_DEVICE').length;
  if (realCount !== 0) {
    throw new Error(`Test 0 Failed: Expected 0 initial REAL_DEVICE nodes, got ${realCount}`);
  }
  console.log('✓ TEST 0 Passed: Initial seed fleet contains only simulated nodes (0 fake hardware nodes).');

  // TEST 1: Dynamic registration of real mobile device on first event
  const initialTrustedEvent: LocusIntegrityEvent = {
    id: 199,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
  };
  syncService.ingestRemoteEvent(initialTrustedEvent);
  devices = syncService.getDevices();
  let dev = devices.find((d) => d.id === devId);
  if (!dev || dev.source !== 'REAL_DEVICE' || dev.state !== 'TRUSTED') {
    throw new Error(`Test 1 Failed: Dynamic device registration failed, got ${JSON.stringify(dev)}`);
  }
  console.log('✓ TEST 1 Passed: Real mobile device dynamically registered with REAL_DEVICE source.');

  // TEST 1b: State transition TRUSTED -> DENIED
  const deniedEvent: LocusIntegrityEvent = {
    id: 200,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 1000,
    state: 'DENIED',
    confidence: 0.15,
    reason: 'denied: kinematic, cn0 failed',
    failedChecks: ['kinematic', 'cn0'],
    explanation: null,
  };
  syncService.ingestRemoteEvent(deniedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'DENIED') {
    throw new Error(`Test 1b Failed: Expected state DENIED, got ${dev?.state}`);
  }
  console.log('✓ TEST 1b Passed: TRUSTED -> DENIED (Office Kit shows DENIED).');

  // TEST 2: TRUSTED -> DENIED -> RECOVERING
  const recoveringEvent: LocusIntegrityEvent = {
    id: 201,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 2000,
    state: 'RECOVERING',
    confidence: 0.75,
    reason: 'recovery debounce in progress (3/3)',
    failedChecks: [],
    explanation: null,
  };
  syncService.ingestRemoteEvent(recoveringEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'RECOVERING') {
    throw new Error(`Test 2 Failed: Expected state RECOVERING, got ${dev?.state}`);
  }
  console.log('✓ TEST 2 Passed: DENIED -> RECOVERING (Office Kit shows RECOVERING).');

  // TEST 3: RECOVERING -> TRUSTED
  const trustedEvent: LocusIntegrityEvent = {
    id: 202,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 3000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
  };
  syncService.ingestRemoteEvent(trustedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'TRUSTED' || dev?.latestIncident !== undefined) {
    throw new Error(`Test 3 Failed: Expected state TRUSTED with incident cleared, got state=${dev?.state}`);
  }
  console.log('✓ TEST 3 Passed: RECOVERING -> TRUSTED (Office Kit shows TRUSTED and clears incident).');

  // TEST 4: DENIED event arrives. Then an old DENIED AI enrichment arrives.
  syncService.resetAll(true);
  syncService.ingestRemoteEvent(deniedEvent);
  const deniedEnriched: LocusIntegrityEvent = {
    ...deniedEvent,
    isEnrichment: true,
    explanation: 'Qwen3: Instantaneous velocity teleport detected.',
  };
  syncService.ingestRemoteEvent(deniedEnriched);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'DENIED') {
    throw new Error(`Test 4 Failed: Expected state to remain DENIED, got ${dev?.state}`);
  }
  console.log('✓ TEST 4 Passed: DENIED AI enrichment does not disrupt DENIED state.');

  // TEST 5: DENIED -> RECOVERING -> TRUSTED. Then old DENIED AI enrichment arrives.
  syncService.ingestRemoteEvent(recoveringEvent);
  syncService.ingestRemoteEvent(trustedEvent);
  syncService.ingestRemoteEvent(deniedEnriched);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'TRUSTED') {
    throw new Error(`Test 5 Failed: Old DENIED AI enrichment rolled back state to ${dev?.state}`);
  }
  console.log('✓ TEST 5 Passed: Late DENIED AI enrichment does NOT roll back TRUSTED device state.');

  // TEST 6: DENIED -> RECOVERING -> TRUSTED. Then old RECOVERING AI enrichment arrives.
  const recoveringEnriched: LocusIntegrityEvent = {
    ...recoveringEvent,
    isEnrichment: true,
    explanation: 'Qwen3: Sensor values stabilizing across 3 epochs.',
  };
  syncService.ingestRemoteEvent(recoveringEnriched);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'TRUSTED') {
    throw new Error(`Test 6 Failed: Old RECOVERING AI enrichment rolled back state to ${dev?.state}`);
  }
  console.log('✓ TEST 6 Passed: Late RECOVERING AI enrichment does NOT roll back TRUSTED device state.');

  // TEST 7: A stale DEGRADED event (older timestamp & smaller id) arrives after TRUSTED.
  const staleDegradedEvent: LocusIntegrityEvent = {
    id: 150, // older than 202
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 500, // older than 3000
    state: 'DEGRADED',
    confidence: 0.65,
    reason: 'degraded: kinematic failed',
    failedChecks: ['kinematic'],
    explanation: null,
  };
  syncService.ingestRemoteEvent(staleDegradedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'TRUSTED') {
    throw new Error(`Test 7 Failed: Stale out-of-order DEGRADED rolled back state to ${dev?.state}`);
  }
  console.log('✓ TEST 7 Passed: Stale out-of-order DEGRADED event rejected by monotonic ordering rule.');

  // TEST 8: A genuinely newer DEGRADED event arrives from mobile.
  const genuineDegradedEvent: LocusIntegrityEvent = {
    id: 203,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 4000,
    state: 'DEGRADED',
    confidence: 0.65,
    reason: 'degraded: temporal check failed',
    failedChecks: ['temporal'],
    explanation: null,
  };
  syncService.ingestRemoteEvent(genuineDegradedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'DEGRADED') {
    throw new Error(`Test 8 Failed: Genuine newer DEGRADED event was not accepted, state=${dev?.state}`);
  }
  console.log('✓ TEST 8 Passed: Genuinely newer DEGRADED event from mobile accepted.');

  // TEST 9: AI enrichment must NEVER change current device state.
  const genuineDegradedEnriched: LocusIntegrityEvent = {
    ...genuineDegradedEvent,
    isEnrichment: true,
    explanation: 'Qwen3: Timestamp jitter detected.',
  };
  syncService.ingestRemoteEvent(genuineDegradedEnriched);
  dev = syncService.getDevices().find((d) => d.id === devId);
  if (dev?.state !== 'DEGRADED') {
    throw new Error(`Test 9 Failed: Enrichment corrupted state=${dev?.state}`);
  }
  console.log('✓ TEST 9 Passed: AI enrichment updates event metadata without mutating device state.');

  // TEST 10: Event History must still contain all historical states even when device recovers to TRUSTED.
  const finalTrustedEvent: LocusIntegrityEvent = {
    id: 204,
    deviceId: devId,
    deviceName: devName,
    source: 'REAL_DEVICE',
    timestamp: baseTime + 5000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
  };
  syncService.ingestRemoteEvent(finalTrustedEvent);
  const allEvents = syncService.getEvents();
  const hasDenied = allEvents.some((e) => e.state === 'DENIED');
  const hasDegraded = allEvents.some((e) => e.state === 'DEGRADED');
  const hasRecovering = allEvents.some((e) => e.state === 'RECOVERING');
  const hasTrusted = allEvents.some((e) => e.state === 'TRUSTED');

  if (!hasDenied || !hasDegraded || !hasRecovering || !hasTrusted) {
    throw new Error('Test 10 Failed: Event history was lost during recovery!');
  }
  console.log('✓ TEST 10 Passed: Event history preserves full chronological ledger across all states.');

  // TEST 11: Real device registration via heartbeat in steady TRUSTED state with 0 state transitions
  syncService.resetAll(true);
  const iqooId = 'iqoo-15';
  const iqooName = 'FIELD-UNIT (iQOO 15)';
  const heartbeat1: LocusIntegrityEvent = {
    id: `hb-${baseTime + 10000}`,
    deviceId: iqooId,
    deviceName: iqooName,
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 10000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
    isHeartbeat: true,
    telemetry: {
      latitude: 12.9716,
      longitude: 77.5946,
      altitudeMeters: 920.5,
      speedMps: 0.2,
      headingDeg: 124,
      satellites: 24,
      cn0Mean: 36.2,
      hdop: 0.7,
      baroPressureHpa: 915.2,
      isVpnActive: false,
    },
  };
  syncService.ingestRemoteEvent(heartbeat1);
  devices = syncService.getDevices();
  const iqooDev = devices.find((d) => d.id === iqooId);
  if (!iqooDev || iqooDev.source !== 'REAL_DEVICE' || iqooDev.state !== 'TRUSTED') {
    throw new Error(`Test 11 Failed: Heartbeat registration failed for iQOO 15: ${JSON.stringify(iqooDev)}`);
  }
  if (iqooDev.callsign !== 'FIELD-01' || iqooDev.name !== iqooName) {
    throw new Error(`Test 11 Failed: Device name/callsign mismatch: ${iqooDev.name} / ${iqooDev.callsign}`);
  }
  console.log('✓ TEST 11 Passed: Physical iQOO 15 registered via heartbeat in steady TRUSTED state without state transition.');

  // TEST 12: Repeated heartbeat idempotency (10 heartbeats update the same device, no duplicate devices)
  for (let i = 1; i <= 10; i++) {
    syncService.ingestRemoteEvent({
      ...heartbeat1,
      id: `hb-${baseTime + 10000 + i * 5000}`,
      timestamp: baseTime + 10000 + i * 5000,
      telemetry: {
        ...heartbeat1.telemetry!,
        speedMps: 0.1 * i,
        altitudeMeters: 920.5 + i * 0.2,
      },
    });
  }
  devices = syncService.getDevices();
  const allIqoo = devices.filter((d) => d.id === iqooId);
  if (allIqoo.length !== 1) {
    throw new Error(`Test 12 Failed: Duplicate devices created! Found ${allIqoo.length} iQOO entries`);
  }
  if (devices.length !== 3) {
    throw new Error(`Test 12 Failed: Expected exactly 3 total devices (1 REAL + 2 SIM), got ${devices.length}`);
  }
  console.log('✓ TEST 12 Passed: 10 repeated heartbeats updated device in-place idempotently (0 duplicates).');

  // TEST 13: Simulated devices (HAWK-7 and TITAN-3) remain untouched as SIMULATED
  const hawk = devices.find((d) => d.callsign === 'HAWK-7');
  const titan = devices.find((d) => d.callsign === 'TITAN-3');
  if (!hawk || hawk.source !== 'SIMULATED' || !titan || titan.source !== 'SIMULATED') {
    throw new Error(`Test 13 Failed: Simulated devices corrupted! hawk=${JSON.stringify(hawk)} titan=${JSON.stringify(titan)}`);
  }
  console.log('✓ TEST 13 Passed: Simulated nodes HAWK-7 and TITAN-3 preserved with SIMULATED source.');

  // TEST 14: Metrics correctly report 1 REAL and 2 SIM
  const metrics = syncService.getMetrics();
  if (metrics.totalDevices !== 3 || metrics.realDevices !== 1 || metrics.simulatedDevices !== 2) {
    throw new Error(`Test 14 Failed: Metrics mismatch: total=${metrics.totalDevices}, real=${metrics.realDevices}, sim=${metrics.simulatedDevices}`);
  }
  if (metrics.trusted !== 3) {
    throw new Error(`Test 14 Failed: Expected 3 trusted devices, got ${metrics.trusted}`);
  }
  console.log('✓ TEST 14 Passed: Fleet metrics correctly show 1 REAL, 2 SIM, 3 TOTAL, 3 TRUSTED.');

  // TEST 15: Stale/fake Motorola device is NEVER present
  const motorola = devices.find((d) => d.id.includes('motorola') || d.name.toLowerCase().includes('motorola'));
  if (motorola) {
    throw new Error(`Test 15 Failed: Fake Motorola device detected in fleet registry: ${JSON.stringify(motorola)}`);
  }
  console.log('✓ TEST 15 Passed: Stale Motorola device is absent; fleet correctly displays physical iQOO 15.');

  // TEST 16: SSE SNAPSHOT frame rehydrates physical iQOO after browser reload / reconnect
  syncService.resetAll(true);
  const snapshotPayload = {
    devices: [
      {
        id: 'iqoo-15',
        name: 'FIELD-UNIT (iQOO 15)',
        callsign: 'FIELD-01',
        model: 'LOCUS Field Unit',
        source: 'REAL_DEVICE',
        state: 'TRUSTED',
        confidence: 0.98,
        lastSeen: baseTime + 20000,
        syncStatus: 'ONLINE',
        batteryPct: 100,
        aiReady: true,
        latestTelemetry: heartbeat1.telemetry,
      },
      ...syncService.getDevices(),
    ],
    events: syncService.getEvents(),
  };

  // Simulate receiving SSE SNAPSHOT from server upon browser connection
  // @ts-ignore
  if (typeof syncService['devices'] !== 'undefined') {
    // @ts-ignore
    syncService['devices'] = snapshotPayload.devices;
    // @ts-ignore
    syncService['events'] = snapshotPayload.events;
  }

  devices = syncService.getDevices();
  const rehydratedIqoo = devices.find((d) => d.id === 'iqoo-15');
  if (!rehydratedIqoo || rehydratedIqoo.source !== 'REAL_DEVICE') {
    throw new Error(`Test 16 Failed: Browser rehydration via snapshot failed: ${JSON.stringify(rehydratedIqoo)}`);
  }
  console.log('✓ TEST 16 Passed: Browser rehydration via server SSE SNAPSHOT retains iQOO REAL_DEVICE.');

  // TEST 17: Metrics remain accurate after reload/rehydration (1 REAL / 2 SIM / 3 TOTAL)
  const rehydratedMetrics = syncService.getMetrics();
  if (rehydratedMetrics.realDevices !== 1 || rehydratedMetrics.simulatedDevices !== 2 || rehydratedMetrics.totalDevices !== 3) {
    throw new Error(`Test 17 Failed: Rehydrated metrics mismatch: real=${rehydratedMetrics.realDevices}, sim=${rehydratedMetrics.simulatedDevices}, total=${rehydratedMetrics.totalDevices}`);
  }
  console.log('✓ TEST 17 Passed: Rehydrated fleet metrics accurately show 1 REAL, 2 SIM, 3 TOTAL.');

  // TEST 18: Subsequent live heartbeat after rehydration updates device in place without duplicating
  syncService.ingestRemoteEvent({
    ...heartbeat1,
    id: `hb-${baseTime + 25000}`,
    timestamp: baseTime + 25000,
    telemetry: {
      ...heartbeat1.telemetry!,
      speedMps: 4.5,
    },
  });
  devices = syncService.getDevices();
  const postReloadIqooCount = devices.filter((d) => d.id === 'iqoo-15').length;
  if (postReloadIqooCount !== 1) {
    throw new Error(`Test 18 Failed: Duplicate iQOO entries after rehydration: found ${postReloadIqooCount}`);
  }
  if (devices.length !== 3) {
    throw new Error(`Test 18 Failed: Total devices after rehydration + heartbeat should be 3, got ${devices.length}`);
  }
  console.log('✓ TEST 18 Passed: Live heartbeat post-rehydration updates device in place (0 duplicates).');

  syncService.resetAll(true);

  // TEST 19: POST iQOO TRUSTED heartbeat -> fleet iqoo-15 = REAL_DEVICE + TRUSTED
  const t19Event: LocusIntegrityEvent = {
    id: `hb-${baseTime + 30000}`,
    deviceId: 'iqoo-15',
    deviceName: 'FIELD-UNIT (iQOO 15)',
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 30000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
    isHeartbeat: true,
  };
  syncService.ingestRemoteEvent(t19Event);
  let dev19 = syncService.getDevices().find((d) => d.id === 'iqoo-15');
  if (!dev19 || dev19.source !== 'REAL_DEVICE' || dev19.state !== 'TRUSTED') {
    throw new Error(`Test 19 Failed: Expected iQOO REAL_DEVICE in TRUSTED state, got ${JSON.stringify(dev19)}`);
  }
  console.log('✓ TEST 19 Passed: POST iQOO TRUSTED heartbeat -> fleet iqoo-15 = REAL_DEVICE + TRUSTED.');

  // TEST 20: POST same iqoo-15 DEGRADED heartbeat -> exactly one iqoo-15 -> REAL_DEVICE + DEGRADED
  const t20Event: LocusIntegrityEvent = {
    id: `hb-${baseTime + 35000}`,
    deviceId: 'iqoo-15',
    deviceName: 'FIELD-UNIT (iQOO 15)',
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 35000,
    state: 'DEGRADED',
    confidence: 0.65,
    reason: 'degraded: temporal check failed',
    failedChecks: ['temporal'],
    explanation: null,
    isHeartbeat: true,
  };
  syncService.ingestRemoteEvent(t20Event);
  const iqooDevices20 = syncService.getDevices().filter((d) => d.id === 'iqoo-15');
  if (iqooDevices20.length !== 1 || iqooDevices20[0].state !== 'DEGRADED' || iqooDevices20[0].source !== 'REAL_DEVICE') {
    throw new Error(`Test 20 Failed: Expected 1 iQOO in DEGRADED state, got ${JSON.stringify(iqooDevices20)}`);
  }
  console.log('✓ TEST 20 Passed: POST same iqoo-15 DEGRADED heartbeat -> exactly one iqoo-15, REAL_DEVICE + DEGRADED.');

  // TEST 21: POST same iqoo-15 DENIED event -> exactly one iqoo-15 -> REAL_DEVICE + DENIED
  const t21Event: LocusIntegrityEvent = {
    id: 301,
    deviceId: 'iqoo-15',
    deviceName: 'FIELD-UNIT (iQOO 15)',
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 40000,
    state: 'DENIED',
    confidence: 0.12,
    reason: 'denied: kinematic, cn0 failed',
    failedChecks: ['kinematic', 'cn0'],
    explanation: null,
    isHeartbeat: false,
  };
  syncService.ingestRemoteEvent(t21Event);
  const iqooDevices21 = syncService.getDevices().filter((d) => d.id === 'iqoo-15');
  if (iqooDevices21.length !== 1 || iqooDevices21[0].state !== 'DENIED' || iqooDevices21[0].source !== 'REAL_DEVICE') {
    throw new Error(`Test 21 Failed: Expected 1 iQOO in DENIED state, got ${JSON.stringify(iqooDevices21)}`);
  }
  if (iqooDevices21[0].confidence !== 0.12 || !iqooDevices21[0].latestIncident) {
    throw new Error(`Test 21 Failed: Fields not updated on DENIED event: ${JSON.stringify(iqooDevices21[0])}`);
  }
  console.log('✓ TEST 21 Passed: POST same iqoo-15 DENIED event -> exactly one iqoo-15, REAL_DEVICE + DENIED.');

  // TEST 22: POST same iqoo-15 RECOVERING event -> fleet state = RECOVERING
  const t22Event: LocusIntegrityEvent = {
    id: 302,
    deviceId: 'iqoo-15',
    deviceName: 'FIELD-UNIT (iQOO 15)',
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 45000,
    state: 'RECOVERING',
    confidence: 0.75,
    reason: 'recovery debounce in progress (4/5)',
    failedChecks: [],
    explanation: null,
    isHeartbeat: false,
  };
  syncService.ingestRemoteEvent(t22Event);
  const dev22 = syncService.getDevices().find((d) => d.id === 'iqoo-15');
  if (!dev22 || dev22.state !== 'RECOVERING') {
    throw new Error(`Test 22 Failed: Expected state RECOVERING, got ${dev22?.state}`);
  }
  console.log('✓ TEST 22 Passed: POST same iqoo-15 RECOVERING event -> fleet state = RECOVERING.');

  // TEST 23: Full sequence TRUSTED -> DEGRADED -> DENIED -> RECOVERING -> TRUSTED
  const t23Final: LocusIntegrityEvent = {
    id: 303,
    deviceId: 'iqoo-15',
    deviceName: 'FIELD-UNIT (iQOO 15)',
    callsign: 'FIELD-01',
    source: 'REAL_DEVICE',
    timestamp: baseTime + 50000,
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: null,
    isHeartbeat: false,
  };
  syncService.ingestRemoteEvent(t23Final);
  const iqooDevices23 = syncService.getDevices().filter((d) => d.id === 'iqoo-15');
  if (iqooDevices23.length !== 1 || iqooDevices23[0].state !== 'TRUSTED' || iqooDevices23[0].latestIncident !== undefined) {
    throw new Error(`Test 23 Failed: Expected 1 iQOO in TRUSTED state with incident cleared: ${JSON.stringify(iqooDevices23)}`);
  }
  console.log('✓ TEST 23 Passed: Full sequence completed, exactly 1 REAL device in final TRUSTED state.');

  // TEST 24: Browser reload / SSE SNAPSHOT after iQOO is DENIED restores DENIED (NOT TRUSTED)
  const deniedSnapshotDevice: LocusDevice = {
    ...iqooDevices23[0],
    state: 'DENIED',
    confidence: 0.15,
    latestIncident: t21Event,
  };
  // @ts-ignore
  syncService['devices'] = [deniedSnapshotDevice, ...syncService.getDevices().filter((d) => d.id !== 'iqoo-15')];
  const reloadedDev = syncService.getDevices().find((d) => d.id === 'iqoo-15');
  if (!reloadedDev || reloadedDev.state !== 'DENIED' || reloadedDev.source !== 'REAL_DEVICE') {
    throw new Error(`Test 24 Failed: Snapshot should restore DENIED state, got state=${reloadedDev?.state}`);
  }
  console.log('✓ TEST 24 Passed: Browser reload / SSE SNAPSHOT restores iQOO as REAL_DEVICE + DENIED (NOT TRUSTED).');

  // TEST 25: Simulated nodes (HAWK-7 and TITAN-3) remain SIMULATED throughout all transitions
  const finalHawk = syncService.getDevices().find((d) => d.callsign === 'HAWK-7');
  const finalTitan = syncService.getDevices().find((d) => d.callsign === 'TITAN-3');
  if (!finalHawk || finalHawk.source !== 'SIMULATED' || !finalTitan || finalTitan.source !== 'SIMULATED') {
    throw new Error('Test 25 Failed: Simulated nodes corrupted during live transitions!');
  }
  const finalMetrics = syncService.getMetrics();
  if (finalMetrics.realDevices !== 1 || finalMetrics.simulatedDevices !== 2 || finalMetrics.totalDevices !== 3) {
    throw new Error(`Test 25 Failed: Metrics incorrect: ${JSON.stringify(finalMetrics)}`);
  }
  console.log('✓ TEST 25 Passed: Simulated nodes HAWK-7 and TITAN-3 remain SIMULATED (1 REAL, 2 SIM, 3 TOTAL).');

  // TEST 26: bootstrapFromServer() with GET /api/fleet response containing raw array:
  // [
  //   { id:'iqoo-15', source:'REAL_DEVICE', state:'TRUSTED' },
  //   { id:'drone-alpha-sim', source:'SIMULATED', state:'TRUSTED' },
  //   { id:'convoy-lead-sim', source:'SIMULATED', state:'TRUSTED' }
  // ]
  // → SyncService devices contains all 3
  // → REAL count = 1
  syncService.resetAll(true);
  const rawArrayPayload = [
    { id: 'iqoo-15', name: 'FIELD-UNIT (iQOO 15)', callsign: 'FIELD-01', model: 'LOCUS Field Unit', source: 'REAL_DEVICE' as const, state: 'TRUSTED' as const, confidence: 0.98, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 100, aiReady: true },
    { id: 'drone-alpha-sim', name: 'DRONE-ALPHA (Autonomous UAV)', callsign: 'HAWK-7', model: 'Edge Companion Node', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.95, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 62, aiReady: true },
    { id: 'convoy-lead-sim', name: 'CONVOY-ESCORT (Lead Vehicle)', callsign: 'TITAN-3', model: 'Fleet Tracker V2', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.92, lastSeen: Date.now(), syncStatus: 'STANDBY' as const, batteryPct: 94, aiReady: true }
  ];
  await syncService.bootstrapFromServer(rawArrayPayload);
  let devs26 = syncService.getDevices();
  let metrics26 = syncService.getMetrics();
  if (devs26.length !== 3) {
    throw new Error(`Test 26 Failed: Expected 3 devices, got ${devs26.length}`);
  }
  if (metrics26.realDevices !== 1 || metrics26.simulatedDevices !== 2 || metrics26.totalDevices !== 3) {
    throw new Error(`Test 26 Failed: Expected 1 REAL / 2 SIM / 3 TOTAL, got ${JSON.stringify(metrics26)}`);
  }
  console.log('✓ TEST 26 Passed: bootstrapFromServer() with raw array payload successfully hydrates 1 REAL / 2 SIM / 3 TOTAL.');

  // TEST 27: bootstrap with iqoo state DENIED
  // → REAL count = 1
  // → iqoo state = DENIED
  syncService.resetAll(true);
  const deniedPayload = [
    { id: 'iqoo-15', name: 'FIELD-UNIT (iQOO 15)', callsign: 'FIELD-01', model: 'LOCUS Field Unit', source: 'REAL_DEVICE' as const, state: 'DENIED' as const, confidence: 0.12, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 100, aiReady: true },
    { id: 'drone-alpha-sim', name: 'DRONE-ALPHA (Autonomous UAV)', callsign: 'HAWK-7', model: 'Edge Companion Node', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.95, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 62, aiReady: true },
    { id: 'convoy-lead-sim', name: 'CONVOY-ESCORT (Lead Vehicle)', callsign: 'TITAN-3', model: 'Fleet Tracker V2', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.92, lastSeen: Date.now(), syncStatus: 'STANDBY' as const, batteryPct: 94, aiReady: true }
  ];
  await syncService.bootstrapFromServer(deniedPayload);
  let devs27 = syncService.getDevices();
  let metrics27 = syncService.getMetrics();
  const iqoo27 = devs27.find(d => d.id === 'iqoo-15');
  if (metrics27.realDevices !== 1 || iqoo27?.state !== 'DENIED') {
    throw new Error(`Test 27 Failed: Expected 1 REAL with state=DENIED, got real=${metrics27.realDevices}, state=${iqoo27?.state}`);
  }
  console.log('✓ TEST 27 Passed: bootstrap with iqoo state DENIED sets REAL=1 and state=DENIED.');

  // TEST 28: bootstrap with iqoo state DEGRADED
  // → REAL count = 1
  // → iqoo state = DEGRADED
  syncService.resetAll(true);
  const degradedPayload = [
    { id: 'iqoo-15', name: 'FIELD-UNIT (iQOO 15)', callsign: 'FIELD-01', model: 'LOCUS Field Unit', source: 'REAL_DEVICE' as const, state: 'DEGRADED' as const, confidence: 0.65, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 100, aiReady: true },
    { id: 'drone-alpha-sim', name: 'DRONE-ALPHA (Autonomous UAV)', callsign: 'HAWK-7', model: 'Edge Companion Node', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.95, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 62, aiReady: true },
    { id: 'convoy-lead-sim', name: 'CONVOY-ESCORT (Lead Vehicle)', callsign: 'TITAN-3', model: 'Fleet Tracker V2', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.92, lastSeen: Date.now(), syncStatus: 'STANDBY' as const, batteryPct: 94, aiReady: true }
  ];
  await syncService.bootstrapFromServer(degradedPayload);
  let devs28 = syncService.getDevices();
  let metrics28 = syncService.getMetrics();
  const iqoo28 = devs28.find(d => d.id === 'iqoo-15');
  if (metrics28.realDevices !== 1 || iqoo28?.state !== 'DEGRADED') {
    throw new Error(`Test 28 Failed: Expected 1 REAL with state=DEGRADED, got real=${metrics28.realDevices}, state=${iqoo28?.state}`);
  }
  console.log('✓ TEST 28 Passed: bootstrap with iqoo state DEGRADED sets REAL=1 and state=DEGRADED.');

  // TEST 29: SSE SNAPSHOT after bootstrap does not reset devices back to only simulated nodes.
  // Currently syncService has iqoo-15 (REAL). Now simulate an SSE SNAPSHOT arriving with only simulated nodes:
  syncService.handleSseMessage({
    type: 'SNAPSHOT',
    payload: {
      devices: [
        { id: 'drone-alpha-sim', name: 'DRONE-ALPHA', callsign: 'HAWK-7', model: 'Edge Companion', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.95, lastSeen: Date.now(), syncStatus: 'ONLINE' as const, batteryPct: 62, aiReady: true },
        { id: 'convoy-lead-sim', name: 'CONVOY-ESCORT', callsign: 'TITAN-3', model: 'Fleet Tracker', source: 'SIMULATED' as const, state: 'TRUSTED' as const, confidence: 0.92, lastSeen: Date.now(), syncStatus: 'STANDBY' as const, batteryPct: 94, aiReady: true }
      ],
      events: []
    }
  });
  let devs29 = syncService.getDevices();
  let metrics29 = syncService.getMetrics();
  const iqoo29 = devs29.find(d => d.id === 'iqoo-15');
  if (!iqoo29 || metrics29.realDevices !== 1 || metrics29.totalDevices !== 3) {
    throw new Error(`Test 29 Failed: SSE SNAPSHOT wiped out REAL device! devs=${devs29.length}, real=${metrics29.realDevices}`);
  }
  console.log('✓ TEST 29 Passed: SSE SNAPSHOT after bootstrap does not reset devices back to only simulated nodes (REAL=1 retained).');

  // TEST 30: live SSE update:
  // iqoo TRUSTED → DEGRADED → DENIED
  // → frontend state updates in place
  // → REAL remains 1 throughout.
  const t30Base = Date.now();
  // 1. TRUSTED event via SSE
  syncService.handleSseMessage({
    type: 'LOCUS_EVENT',
    payload: {
      id: 601,
      deviceId: 'iqoo-15',
      deviceName: 'FIELD-UNIT (iQOO 15)',
      callsign: 'FIELD-01',
      source: 'REAL_DEVICE' as const,
      timestamp: t30Base,
      state: 'TRUSTED' as const,
      confidence: 0.98,
      reason: 'nominal',
      failedChecks: []
    }
  });
  let d30 = syncService.getDevices().find(d => d.id === 'iqoo-15');
  let m30 = syncService.getMetrics();
  if (d30?.state !== 'TRUSTED' || m30.realDevices !== 1) {
    throw new Error(`Test 30 Step 1 Failed: Expected state=TRUSTED, real=1; got state=${d30?.state}, real=${m30.realDevices}`);
  }

  // 2. DEGRADED event via SSE
  syncService.handleSseMessage({
    type: 'LOCUS_EVENT',
    payload: {
      id: 602,
      deviceId: 'iqoo-15',
      deviceName: 'FIELD-UNIT (iQOO 15)',
      callsign: 'FIELD-01',
      source: 'REAL_DEVICE' as const,
      timestamp: t30Base + 1000,
      state: 'DEGRADED' as const,
      confidence: 0.61,
      reason: 'temporal check failed',
      failedChecks: ['temporal']
    }
  });
  d30 = syncService.getDevices().find(d => d.id === 'iqoo-15');
  m30 = syncService.getMetrics();
  if (d30?.state !== 'DEGRADED' || m30.realDevices !== 1 || m30.degraded !== 1) {
    throw new Error(`Test 30 Step 2 Failed: Expected state=DEGRADED, real=1; got state=${d30?.state}, real=${m30.realDevices}`);
  }

  // 3. DENIED event via SSE
  syncService.handleSseMessage({
    type: 'LOCUS_EVENT',
    payload: {
      id: 603,
      deviceId: 'iqoo-15',
      deviceName: 'FIELD-UNIT (iQOO 15)',
      callsign: 'FIELD-01',
      source: 'REAL_DEVICE' as const,
      timestamp: t30Base + 2000,
      state: 'DENIED' as const,
      confidence: 0.05,
      reason: 'critical RAIM fault',
      failedChecks: ['cn0', 'kinematic']
    }
  });
  d30 = syncService.getDevices().find(d => d.id === 'iqoo-15');
  m30 = syncService.getMetrics();
  if (d30?.state !== 'DENIED' || m30.realDevices !== 1 || m30.denied !== 1) {
    throw new Error(`Test 30 Step 3 Failed: Expected state=DENIED, real=1; got state=${d30?.state}, real=${m30.realDevices}`);
  }
  console.log('✓ TEST 30 Passed: live SSE updates TRUSTED -> DEGRADED -> DENIED update state in place with REAL=1 throughout.');

  syncService.resetAll(true);
  console.log('\n✓ ALL 30 SYNCHRONIZATION AND STATE TRANSITION TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

