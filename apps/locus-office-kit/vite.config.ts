import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

interface ClientResponse extends ServerResponse {
  _sseId?: number;
}

// In-memory event stream clients for live SSE sync
const sseClients = new Set<ClientResponse>();

// Initial simulated fleet nodes (HAWK-7 and TITAN-3)
const INITIAL_SERVER_DEVICES = [
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

const INITIAL_SERVER_EVENTS = [
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
    telemetry: INITIAL_SERVER_DEVICES[0].latestTelemetry,
  },
];

let serverDevices: any[] = JSON.parse(JSON.stringify(INITIAL_SERVER_DEVICES));
let serverEvents: any[] = JSON.parse(JSON.stringify(INITIAL_SERVER_EVENTS));

function updateServerFleet(payload: any) {
  const source = payload.source || 'REAL_DEVICE';
  const cleanEvent = { ...payload, source };
  const isHeartbeat = cleanEvent.isHeartbeat === true;
  const isEnrichment = cleanEvent.isEnrichment === true;

  // 1. Maintain event history
  const existingEventIndex = serverEvents.findIndex((e) => e.id === cleanEvent.id);
  if (existingEventIndex >= 0) {
    serverEvents[existingEventIndex] = cleanEvent;
  } else if (!isHeartbeat) {
    serverEvents = [cleanEvent, ...serverEvents];
  }

  // 2. Maintain device registry
  const existingDevIndex = serverDevices.findIndex((d) => d.id === cleanEvent.deviceId);
  if (existingDevIndex >= 0) {
    const dev = serverDevices[existingDevIndex];

    // If this is purely an enrichment update for an older event, update the incident reference if it matches,
    // but DO NOT roll back the active device state to an old event's state!
    if (isEnrichment) {
      let updatedIncident = dev.latestIncident;
      if (dev.latestIncident?.id === cleanEvent.id) {
        updatedIncident = cleanEvent;
      }
      serverDevices[existingDevIndex] = {
        ...dev,
        latestIncident: updatedIncident,
      };
      return;
    }

    const isIntegrityState = ['TRUSTED', 'DEGRADED', 'DENIED', 'RECOVERING'].includes(cleanEvent.state);
    const nextState = isIntegrityState ? cleanEvent.state : dev.state;
    const nextIncident =
      cleanEvent.state === 'DENIED' || cleanEvent.state === 'DEGRADED'
        ? cleanEvent
        : cleanEvent.state === 'TRUSTED'
        ? undefined
        : dev.latestIncident;

    serverDevices[existingDevIndex] = {
      ...dev,
      name: cleanEvent.deviceName || dev.name,
      callsign: cleanEvent.callsign || dev.callsign,
      source: cleanEvent.source || dev.source,
      state: nextState,
      confidence: typeof cleanEvent.confidence === 'number' ? cleanEvent.confidence : dev.confidence,
      lastSeen: Math.max(dev.lastSeen || 0, cleanEvent.timestamp || Date.now()),
      syncStatus: 'ONLINE',
      latestTelemetry: cleanEvent.telemetry ?? dev.latestTelemetry,
      latestIncident: nextIncident,
    };
  } else {
    const defaultCallsign = cleanEvent.deviceId.toLowerCase().includes('iqoo')
      ? 'FIELD-01'
      : `NODE-${cleanEvent.deviceId.slice(-4).toUpperCase()}`;

    const newDev = {
      id: cleanEvent.deviceId,
      name: cleanEvent.deviceName || `LOCUS-NODE-${cleanEvent.deviceId.slice(0, 6)}`,
      callsign: cleanEvent.callsign || defaultCallsign,
      model: 'LOCUS Field Unit',
      source,
      state: cleanEvent.state === 'NETWORK' ? 'TRUSTED' : cleanEvent.state,
      confidence: cleanEvent.confidence ?? 0.98,
      lastSeen: cleanEvent.timestamp || Date.now(),
      syncStatus: 'ONLINE',
      batteryPct: 100,
      aiReady: true,
      latestTelemetry: cleanEvent.telemetry,
      latestIncident:
        cleanEvent.state === 'DENIED' || cleanEvent.state === 'DEGRADED' ? cleanEvent : undefined,
    };
    serverDevices = [newDev, ...serverDevices];
  }
}

function locusSyncApiPlugin(): Plugin {
  return {
    name: 'locus-sync-api',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Enable CORS for physical mobile devices on the LAN or via ADB reverse
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const url = req.url?.split('?')[0];

        // 1. SSE Stream for connected browser clients
        if (url === '/api/stream' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          const clientRes = res as ClientResponse;
          sseClients.add(clientRes);

          // Send initial keepalive
          res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

          // Immediately deliver current server-side fleet & device snapshot
          res.write(
            `data: ${JSON.stringify({
              type: 'SNAPSHOT',
              payload: {
                devices: serverDevices,
                events: serverEvents,
              },
            })}\n\n`,
          );

          req.on('close', () => {
            sseClients.delete(clientRes);
          });
          return;
        }

        // 2. Ingest real device events via HTTP POST
        if (url === '/api/events' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              // Stamp with REAL_DEVICE source if not specified
              if (!payload.source) {
                payload.source = 'REAL_DEVICE';
              }

              console.log(
                `[LOCUS SYNC IN] eventId=${payload.id} state=${payload.state} timestamp=${payload.timestamp} deviceId=${payload.deviceId} confidence=${payload.confidence} reason=${payload.reason} isEnrichment=${payload.isEnrichment}`,
              );

              console.log('[OFFICE_KIT] POST /api/events RECEIVED');
              console.log('[OFFICE_KIT] deviceId =', payload.deviceId);
              console.log('[OFFICE_KIT] isHeartbeat =', payload.isHeartbeat);
              console.log('[OFFICE_KIT] source/device classification =', payload.source);

              // Update in-memory server state
              updateServerFleet(payload);

              // Broadcast to all connected SSE browser clients
              const sseMessage = `data: ${JSON.stringify({ type: 'LOCUS_EVENT', payload })}\n\n`;
              for (const client of sseClients) {
                try {
                  client.write(sseMessage);
                } catch {
                  sseClients.delete(client);
                }
              }

              console.log(`[LOCUS SERVER] SSE broadcast to ${sseClients.size} client(s)`);
              console.log('[OFFICE_KIT] ingest result =', { ok: true, id: payload.id, clientsNotified: sseClients.size });

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, id: payload.id, clientsNotified: sseClients.size }));
            } catch (err: unknown) {
              console.error('[LOCUS SERVER] Error processing /api/events:', err);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          });
          return;
        }

        // 3. Fleet snapshot bootstrap endpoint (for instant page load before SSE connects)
        if (url === '/api/fleet' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              devices: serverDevices,
              events: serverEvents,
              timestamp: Date.now(),
            }),
          );
          return;
        }

        // 4. Reset endpoint for console reset button (preserves physical hardware registry)
        if (url === '/api/reset' && req.method === 'POST') {
          const isForceClear = req.url?.includes('force=true');
          const realDevices = isForceClear ? [] : serverDevices.filter((d) => d.source === 'REAL_DEVICE');
          const initialSimulated = JSON.parse(JSON.stringify(INITIAL_SERVER_DEVICES));
          serverEvents = JSON.parse(JSON.stringify(INITIAL_SERVER_EVENTS));

          serverDevices = [...realDevices, ...initialSimulated];

          const sseMessage = `data: ${JSON.stringify({
            type: 'SNAPSHOT',
            payload: { devices: serverDevices, events: serverEvents },
          })}\n\n`;
          for (const client of sseClients) {
            try {
              client.write(sseMessage);
            } catch {
              sseClients.delete(client);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, devices: serverDevices, events: serverEvents }));
          return;
        }

        // 5. Status check endpoint
        if (url === '/api/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              service: 'LOCUS Office Kit Ingestion Bridge',
              version: '1.0.0',
              activeSseClients: sseClients.size,
              devicesCount: serverDevices.length,
              realDevicesCount: serverDevices.filter((d: any) => d.source === 'REAL_DEVICE').length,
              timestamp: Date.now(),
            }),
          );
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), locusSyncApiPlugin()],
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces (0.0.0.0) so phone can connect via Wi-Fi/ADB
  },
});
