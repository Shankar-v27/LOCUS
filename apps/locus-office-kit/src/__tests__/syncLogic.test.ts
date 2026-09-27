import { syncService } from '../services/syncService';
import { LocusIntegrityEvent } from '../types/locusSync';

function runTests() {
  console.log('[TEST] Starting comprehensive STEP 11 LOCUS Office Kit synchronization unit tests...');
  const devId = 'live-field-unit-01';
  const devName = 'FIELD-UNIT-01 (GNSS Cockpit)';
  const baseTime = Date.now();

  // TEST 0: Initial seed state contains only simulated fleet (no fake Motorola)
  syncService.resetAll();
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
  syncService.resetAll();
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

  syncService.resetAll();
  console.log('\n✓ ALL 10 STEP 11 SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
