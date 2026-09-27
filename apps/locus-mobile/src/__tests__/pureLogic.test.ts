/**
 * Pure-function tests for voice-command matching and semantic search ranking.
 * Both are real product code (no test boundaries); the hooks native parts are untouched.
 */
import { cosineSimilarity } from '../lib/search';
import { matchCommand, VOICE_COMMANDS } from '../hooks/useVoiceCommands';

describe('voice command matching', () => {
  it('knows the fixed command set', () => {
    expect([...VOICE_COMMANDS]).toEqual(['simulate spoof', 'reset', 'show reason']);
  });

  it.each([
    ['simulate spoof', 'Please SIMULATE  SPOOF now!'],
    ['simulate spoof', 'simulate spoof'],
    ['reset', 'RESET the pipeline'],
    ['reset', 'can you reset it for me'],
    ['show reason', 'can you show reason'],
    ['show reason', '  show   reason. '],
    ['show reason', 'SHOW REASON please!!'],
  ])('matches "%s" inside "%p"', (expected, input) => {
    expect(matchCommand(input)).toBe(expected);
  });

  it('returns null for non-command speech', () => {
    expect(matchCommand('hello world')).toBeNull();
    expect(matchCommand('')).toBeNull();
    expect(matchCommand('spoofer simulation')).toBeNull();
  });

  it('prefers the first fixed command that appears', () => {
    expect(matchCommand('reset then simulate spoof')).toBe('reset');
  });
});

describe('cosine similarity ranking', () => {
  it('is 1 for identical vectors, 0 for orthogonal, scale-invariant', () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1, 9);
    expect(cosineSimilarity([1, 0, 1], [0, 1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0, 1], [2, 0, 2])).toBeCloseTo(1, 9);
  });

  it('is safe on empty or mismatched inputs', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('ranks log entries by similarity order', () => {
    const query = [1, 0.2, 0];
    const hits = [
      { id: 1, reason: 'orthogonal-ish', vector: [0, 1, 0.2] },
      { id: 2, reason: 'near-identical', vector: [0.9, 0.1, 0] },
      { id: 3, reason: 'reversed', vector: [-1, 0, 0] },
    ];
    const ranked = hits
      .map((h) => ({ ...h, score: cosineSimilarity(query, h.vector) }))
      .sort((x, y) => y.score - x.score);
    expect(ranked[0].id).toBe(2);
    expect(ranked[ranked.length - 1].id).toBe(3);
  });
});

import {
  getDeviceIdentity,
  normalizeOfficeKitEndpoint,
  getOfficeKitEndpoints,
  DEFAULT_OFFICE_KIT_ENDPOINTS,
} from '../services/locusSyncBroadcaster';

describe('device identity derivation', () => {
  it('returns a valid normalized deviceId, displayName, and callsign', () => {
    const identity = getDeviceIdentity();
    expect(typeof identity.deviceId).toBe('string');
    expect(identity.deviceId.length).toBeGreaterThan(0);
    expect(identity.deviceId).toMatch(/^[a-z0-9-]+$/);
    expect(identity.deviceName.startsWith('FIELD-UNIT')).toBe(true);
    expect(identity.callsign).toBe('FIELD-01');
  });
});

describe('office kit endpoint resolution', () => {
  it('normalizes various host and URL configurations into valid /api/events endpoints', () => {
    expect(normalizeOfficeKitEndpoint('192.168.1.50')).toBe('http://192.168.1.50:5173/api/events');
    expect(normalizeOfficeKitEndpoint('192.168.1.50:5173')).toBe('http://192.168.1.50:5173/api/events');
    expect(normalizeOfficeKitEndpoint('http://192.168.1.50:5173')).toBe('http://192.168.1.50:5173/api/events');
    expect(normalizeOfficeKitEndpoint('http://192.168.1.50:5173/')).toBe('http://192.168.1.50:5173/api/events');
    expect(normalizeOfficeKitEndpoint('http://192.168.1.50:5173/api/events')).toBe(
      'http://192.168.1.50:5173/api/events',
    );
    expect(normalizeOfficeKitEndpoint('https://console.locus-fleet.org')).toBe(
      'https://console.locus-fleet.org/api/events',
    );
    expect(normalizeOfficeKitEndpoint('')).toBe('');
  });

  it('provides default dev endpoints when no environment variable is set', () => {
    const prev = process.env.EXPO_PUBLIC_OFFICE_KIT_URL;
    delete process.env.EXPO_PUBLIC_OFFICE_KIT_URL;
    delete process.env.EXPO_PUBLIC_OFFICE_KIT_HOST;

    const endpoints = getOfficeKitEndpoints();
    expect(endpoints).toEqual(DEFAULT_OFFICE_KIT_ENDPOINTS);

    if (prev) process.env.EXPO_PUBLIC_OFFICE_KIT_URL = prev;
  });

  it('prioritizes EXPO_PUBLIC_OFFICE_KIT_URL when configured', () => {
    const prev = process.env.EXPO_PUBLIC_OFFICE_KIT_URL;
    process.env.EXPO_PUBLIC_OFFICE_KIT_URL = '192.168.1.99';

    const endpoints = getOfficeKitEndpoints();
    expect(endpoints[0]).toBe('http://192.168.1.99:5173/api/events');
    expect(endpoints).toContain('http://localhost:5173/api/events');
    expect(endpoints).toContain('http://10.0.2.2:5173/api/events');

    if (prev) {
      process.env.EXPO_PUBLIC_OFFICE_KIT_URL = prev;
    } else {
      delete process.env.EXPO_PUBLIC_OFFICE_KIT_URL;
    }
  });

  it('supports runtime customEndpoint override', () => {
    const endpoints = getOfficeKitEndpoints('10.200.1.5:8080');
    expect(endpoints[0]).toBe('http://10.200.1.5:8080/api/events');
  });
});


