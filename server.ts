import http from 'node:http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { apiRouter } from './src/routes/api.js';
import { telematicsService } from './src/services/telematics.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'TRUCKWITHEASE Tactical Fleet OS',
    version: '1.0.0',
    founder: 'Jeremiah Morris (Founder & Chief Architect)',
    nodeVersion: process.version,
    port: PORT,
    timestamp: new Date().toISOString(),
    capabilities: [
      'fmcsa_compliance_engine',
      'telematics_websocket_j1939',
      'low_bridge_detection_mesh',
      'salesforce_transport_cloud_v60',
      'gemini_multimodal_copilot',
    ],
  });
});

// Mount Fleet OS API routes
app.use('/api/v1', apiRouter);

// WebSocket Setup for Real-time J1939 CAN-Bus Telemetry Stream
const wss = new WebSocketServer({ server, path: '/ws/telematics' });

wss.on('connection', (ws: WebSocket) => {
  // Send welcome handshake packet
  const handshake = {
    event: 'CONNECTION_ESTABLISHED',
    stream: 'J1939_CANBUS_TELEMETRY_BROADCAST',
    activeVehicle: 'TRK-900',
    timestamp: new Date().toISOString(),
  };
  ws.send(JSON.stringify(handshake));

  // Forward all live telemetry packets
  const unregister = telematicsService.registerBroadcaster((packet) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'TELEMETRY_PACKET', packet }));
    }
  });

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === 'PING') {
        ws.send(JSON.stringify({ action: 'PONG', timestamp: Date.now() }));
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    unregister();
  });
});

// Configure Vite SPA integration
async function setupViteOrStatic() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite dev middleware could not be loaded, fallback to static:', err);
    }
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupViteOrStatic().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===================================================================`);
    console.log(` 🚚 TRUCKWITHEASE ENTERPRISE FLEET OS - TACTICAL LOGISTICS COCKPIT`);
    console.log(` Architect: Jeremiah Morris | Port: ${PORT}`);
    console.log(` HTTP API: http://localhost:${PORT}/api/v1`);
    console.log(` WebSocket: ws://localhost:${PORT}/ws/telematics`);
    console.log(` Health: http://localhost:${PORT}/api/health`);
    console.log(`===================================================================`);
  });
});

export { app, server };
