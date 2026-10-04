import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { APP_VERSION, type ClientToServerEvents, type ServerToClientEvents } from '@scxn/shared';
import type { ServerConfig } from './config';
import { RoomManager } from './rooms/RoomManager';
import { registerSignaling } from './socket/signaling';

export interface ScxnServer {
  http: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  rooms: RoomManager;
  close: () => Promise<void>;
}

export function createScxnServer(config: ServerConfig): ScxnServer {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:', ...config.corsOrigins],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // Screen capture, mic and fullscreen are used by this origin only. Chromium also checks the
  // camera policy when capturing an entire monitor; the app never requests the webcam.
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'display-capture=(self), microphone=(self), camera=(self), fullscreen=(self)',
    );
    next();
  });

  const http = createServer(app);
  const rooms = new RoomManager(config);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: APP_VERSION, rooms: rooms.roomCount });
  });

  // In production the server also serves the built client (single origin → no CORS needed).
  const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: config.corsOrigins.length ? { origin: config.corsOrigins } : undefined,
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });
  const disposeSignaling = registerSignaling(io, rooms, config);

  return {
    http,
    io,
    rooms,
    close: async () => {
      disposeSignaling();
      rooms.dispose();
      await io.close();
    },
  };
}
