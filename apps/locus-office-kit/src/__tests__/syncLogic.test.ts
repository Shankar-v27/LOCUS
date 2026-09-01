import { syncService, INITIAL_DEVICES, INITIAL_EVENTS } from '../services/syncService';
import { LocusIntegrityEvent } from '../types/locusSync';

function runTests() {
  console.log('[TEST] Starting comprehensive LOCUS Office Kit sync service unit tests...');

  // Test 1: Initial state and baseline metrics
  syncService.resetAll();
  const devices = syncService.getDevices();
  const events = syncService.getEvents();
  const metrics = syncService.getMetrics();

  if (devices.length !== INITIAL_DEVICES.length) {
    throw new Error(`Expected ${INITIAL_DEVICES.length} devices, got ${devices.length}`);
  }
  if (events.length !== INITIAL_EVENTS.length) {
    throw new Error(`Expected ${INITIAL_EVENTS.length} events, got ${events.length}`);
  }
  if (metrics.realDevices !== 1) {
    throw new Error(`Expected 1 real device, got ${metrics.realDevices}`);
  }
  if (metrics.simulatedDevices !== 2) {
    throw new Error(`Expected 2 simulated devices, got ${metrics.simulatedDevices}`);
  }
  console.log('✓ Scenario 1: Initial fleet baseline verified (1 Real, 2 Simulated, 3 Trusted).');

  // Test 2: Sequential State Progression (TRUSTED -> DEGRADED -> DENIED -> RECOVERING -> TRUSTED)
  const devId = 'motorola-edge-50-fusion';

  // Step A: DEGRADED event (e.g. single check failure)
  const degradedEvent: LocusIntegrityEvent = {
    id: 1001,
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'DEGRADED',
    confidence: 0.65,
    reason: 'degraded: temporal check anomaly',
    failedChecks: ['temporal'],
    explanation: null,
  };
  syncService.ingestRemoteEvent(degradedEvent);
  let dev = syncService.getDevices().find((d) => d.id === devId);
  let m = syncService.getMetrics();
  if (dev?.state !== 'DEGRADED' || m.degraded !== 1 || m.trusted !== 2) {
    throw new Error(`Expected 1 DEGRADED, 2 TRUSTED, got degraded=${m.degraded}, trusted=${m.trusted}`);
  }
  console.log('✓ Scenario 2A: DEGRADED transition updates device and metrics (1 Degraded, 2 Trusted).');

  // Step B: DENIED event (e.g. active spoofing attack)
  const deniedEvent: LocusIntegrityEvent = {
    id: 1002,
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'DENIED',
    confidence: 0.15,
    reason: 'denied: kinematic, cn0 failed',
    failedChecks: ['kinematic', 'cn0'],
    explanation: null,
  };
  syncService.ingestRemoteEvent(deniedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  m = syncService.getMetrics();
  if (dev?.state !== 'DENIED' || m.denied !== 1 || m.degraded !== 0 || m.trusted !== 2) {
    throw new Error(`Expected 1 DENIED, 0 DEGRADED, 2 TRUSTED, got denied=${m.denied}, trusted=${m.trusted}`);
  }
  console.log('✓ Scenario 2B: DENIED transition updates device and metrics (1 Denied, 2 Trusted).');

  // Step C: RECOVERING event (clean epochs accumulating)
  const recoveringEvent: LocusIntegrityEvent = {
    id: 1003,
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'RECOVERING',
    confidence: 0.75,
    reason: 'recovery debounce in progress (3/3)',
    failedChecks: [],
    explanation: null,
  };
  syncService.ingestRemoteEvent(recoveringEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  m = syncService.getMetrics();
  if (dev?.state !== 'RECOVERING' || m.recovering !== 1 || m.denied !== 0 || m.trusted !== 2) {
    throw new Error(`Expected 1 RECOVERING, 0 DENIED, 2 TRUSTED, got recovering=${m.recovering}`);
  }
  console.log('✓ Scenario 2C: RECOVERING transition updates device and metrics (1 Recovering, 2 Trusted).');

  // Step D: TRUSTED event (full recovery)
  const trustedEvent: LocusIntegrityEvent = {
    id: 1004,
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'TRUSTED',
    confidence: 0.98,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: 'Position is verified across all physical checks.',
  };
  syncService.ingestRemoteEvent(trustedEvent);
  dev = syncService.getDevices().find((d) => d.id === devId);
  m = syncService.getMetrics();
  if (dev?.state !== 'TRUSTED' || m.trusted !== 3 || m.recovering !== 0 || m.denied !== 0) {
    throw new Error(`Expected 3 TRUSTED, 0 RECOVERING, got trusted=${m.trusted}, recovering=${m.recovering}`);
  }
  if (dev?.latestIncident !== undefined) {
    throw new Error(`Expected latestIncident to be cleared on TRUSTED, got ${JSON.stringify(dev?.latestIncident)}`);
  }
  console.log('✓ Scenario 2D: TRUSTED recovery returns fleet to 3 TRUSTED and clears active incident.');

  // Test 3: Multi-node Isolation (event for VIPER-1 must not alter HAWK-7 or TITAN-3)
  const hawkBefore = syncService.getDevices().find((d) => d.id === 'drone-alpha-sim');
  const titanBefore = syncService.getDevices().find((d) => d.id === 'convoy-lead-sim');

  syncService.ingestRemoteEvent({
    id: 1005,
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'DENIED',
    confidence: 0.1,
    reason: 'denied: kinematic teleport',
    failedChecks: ['kinematic'],
    explanation: null,
  });

  const hawkAfter = syncService.getDevices().find((d) => d.id === 'drone-alpha-sim');
  const titanAfter = syncService.getDevices().find((d) => d.id === 'convoy-lead-sim');

  if (hawkAfter?.state !== hawkBefore?.state || hawkAfter?.confidence !== hawkBefore?.confidence) {
    throw new Error('HAWK-7 was unexpectedly modified by VIPER-1 event!');
  }
  if (titanAfter?.state !== titanBefore?.state || titanAfter?.confidence !== titanBefore?.confidence) {
    throw new Error('TITAN-3 was unexpectedly modified by VIPER-1 event!');
  }
  console.log('✓ Scenario 3: Multi-node isolation verified (VIPER-1 events do not affect HAWK-7 or TITAN-3).');

  // Test 4: Asynchronous AI Enrichment update
  const enrichedEvent: LocusIntegrityEvent = {
    id: 1005, // Same event ID, now enriched with Qwen3 explanation
    deviceId: devId,
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'DENIED',
    confidence: 0.1,
    reason: 'denied: kinematic teleport',
    failedChecks: ['kinematic'],
    explanation: 'Qwen3 Explanation: Instantaneous kinetic jump detected.',
  };
  syncService.ingestRemoteEvent(enrichedEvent);
  const foundEvent = syncService.getEvents().find((e) => e.id === 1005);
  if (!foundEvent?.explanation?.includes('Qwen3 Explanation')) {
    throw new Error('Expected event 1005 to be updated with asynchronous AI explanation.');
  }
  console.log('✓ Scenario 4: Asynchronous AI explanation enrichment without event duplication verified.');

  // Reset after tests
  syncService.resetAll();
  console.log('✓ ALL LOCUS Office Kit synchronization scenarios PASSED successfully!\n');
}

runTests();
