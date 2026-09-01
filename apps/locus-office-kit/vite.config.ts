import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

interface ClientResponse extends ServerResponse {
  _sseId?: number;
}

// In-memory event stream clients for live SSE sync
const sseClients = new Set<ClientResponse>();

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

        // 3. Status check endpoint
        if (url === '/api/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              service: 'LOCUS Office Kit Ingestion Bridge',
              version: '1.0.0',
              activeSseClients: sseClients.size,
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
