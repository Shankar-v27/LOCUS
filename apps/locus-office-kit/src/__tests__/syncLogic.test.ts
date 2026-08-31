import { syncService, INITIAL_DEVICES, INITIAL_EVENTS } from '../services/syncService';
import { LocusIntegrityEvent } from '../types/locusSync';

function runTests() {
  console.log('[TEST] Starting LOCUS Office Kit sync service unit tests...');

  // Test 1: Initial state
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
  console.log('✓ Initial state and metrics verified (1 Real, 2 Simulated).');

  // Test 2: Real device event ingestion
  const realEvent: LocusIntegrityEvent = {
    id: 999,
    deviceId: 'motorola-edge-50-fusion',
    deviceName: 'FIELD-UNIT-01 (Motorola Edge 50 Fusion)',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'DENIED',
    confidence: 0.12,
    reason: 'denied: kinematic displacement anomaly',
    failedChecks: ['kinematic', 'cn0'],
    explanation: 'Spoofing detected: kinetic jump of 412 m/s exceeds physical model.',
    telemetry: {
      latitude: 37.4220,
      longitude: -122.0841,
      altitudeMeters: 45.2,
      speedMps: 412.0,
      headingDeg: 124,
      satellites: 14,
      cn0Mean: 34.2,
      hdop: 0.8,
    },
  };

  syncService.ingestRemoteEvent(realEvent);
  const updatedDevs = syncService.getDevices();
  const targetDev = updatedDevs.find((d) => d.id === 'motorola-edge-50-fusion');

  if (!targetDev || targetDev.state !== 'DENIED') {
    throw new Error(`Expected target device to be in DENIED state, got ${targetDev?.state}`);
  }
  if (targetDev.source !== 'REAL_DEVICE') {
    throw new Error(`Expected target device source to be REAL_DEVICE, got ${targetDev.source}`);
  }
  if (targetDev.latestIncident?.id !== 999) {
    throw new Error(`Expected latest incident id 999, got ${targetDev.latestIncident?.id}`);
  }
  console.log('✓ Real device event ingestion and DENIED transition verified.');

  // Test 3: Dynamic registration of a new field device
  const dynamicEvent: LocusIntegrityEvent = {
    id: 1000,
    deviceId: 'field-unit-09-new',
    deviceName: 'PATROL-BRAVO-09',
    source: 'REAL_DEVICE',
    timestamp: Date.now(),
    state: 'TRUSTED',
    confidence: 0.99,
    reason: 'all checks passed',
    failedChecks: [],
    explanation: 'Nominal GPS integrity.',
  };

  syncService.ingestRemoteEvent(dynamicEvent);
  const afterDynamic = syncService.getDevices();
  const newDev = afterDynamic.find((d) => d.id === 'field-unit-09-new');

  if (!newDev) {
    throw new Error('Expected dynamic device to be registered');
  }
  if (newDev.source !== 'REAL_DEVICE') {
    throw new Error(`Expected new device to have REAL_DEVICE source, got ${newDev.source}`);
  }
  console.log('✓ Dynamic field device registration verified.');

  // Test 4: Simulated attack & 5-epoch recovery
  syncService.triggerAttack('drone-alpha-sim', 'teleport');
  const simDev = syncService.getDevices().find((d) => d.id === 'drone-alpha-sim');
  if (simDev?.state !== 'DENIED') {
    throw new Error(`Expected simulated drone to be DENIED, got ${simDev?.state}`);
  }
  if (simDev.source !== 'SIMULATED') {
    throw new Error(`Expected simulated drone source to be SIMULATED, got ${simDev.source}`);
  }
  console.log('✓ Simulation attack trigger verified with explicit SIMULATED source.');

  // Reset after tests
  syncService.resetAll();
  console.log('✓ All 4 Office Kit sync tests PASSED successfully!\n');
}

runTests();
