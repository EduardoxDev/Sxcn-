import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import {
  audioStateSchema,
  candidateRelaySchema,
  connectionStateSchema,
  descriptionRelaySchema,
  emptySchema,
  kickSchema,
  roomJoinSchema,
  roomPeekSchema,
  screenPauseSchema,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents,
} from '@scxn/shared';
import type { ServerConfig } from '../config';
import { createIceServerProvider } from '../lib/iceServers';
import { KeyedRateLimiter, TokenBucket } from '../lib/rateLimit';
import type { RoomManager } from '../rooms/RoomManager';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ScxnSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const channel = (code: string) => `room:${code}`;

function reply<T>(ack: unknown, res: Ack<T>): void {
  if (typeof ack === 'function') (ack as (r: Ack<T>) => void)(res);
}

function error<T>(ack: unknown, code: ErrorCode, message: string): void {
  reply<T>(ack, { ok: false, error: { code, message } });
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> | null {
  const result = schema.safeParse(payload);
  return result.success ? result.data : null;
}

function clientIp(socket: ScxnSocket, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
}

/**
 * Wires Socket.IO to the RoomManager. This layer only validates, rate-limits, authorizes and
 * relays — all room state lives in the manager.
 */
export function registerSignaling(io: IO, rooms: RoomManager, config: ServerConfig): () => void {
  const createLimiter = new KeyedRateLimiter(6, 6 / 60); // 6 rooms/min per IP
  const joinLimiter = new KeyedRateLimiter(20, 20 / 60);
  const peekLimiter = new KeyedRateLimiter(30, 1);
  const getIceServers = createIceServerProvider(config);

  // ── Domain events → broadcasts ───────────────────────────────────────────
  rooms.on('joined', ({ code, participant, socketId }) => {
    io.to(channel(code)).except(socketId).emit('participant:joined', participant);
  });
  rooms.on('updated', ({ code, participant }) => {
    io.to(channel(code)).emit('participant:updated', participant);
  });
  rooms.on('left', ({ code, participantId, reason, socketId }) => {
    io.to(channel(code)).emit('participant:left', { id: participantId, reason });
    if (socketId) io.in(socketId).socketsLeave(channel(code));
  });
  rooms.on('screen', ({ code, participantId, active }) => {
    io.to(channel(code)).emit(active ? 'screen:start' : 'screen:stop', { participantId });
  });
  rooms.on('ended', ({ code, reason, socketIds }) => {
    if (socketIds.length) io.to(socketIds).emit('room:ended', { reason });
    io.in(channel(code)).socketsLeave(channel(code));
  });

  io.on('connection', (socket) => {
    const ip = clientIp(socket, config.trustProxy);
    // Generous enough for ICE candidate bursts, tight enough to stop floods.
    const bucket = new TokenBucket(200, 50);

    socket.use((_packet, next) => {
      if (bucket.take()) return next();
      next(new Error('RATE_LIMITED'));
    });

    const self = () => rooms.participantForSocket(socket.id);

    socket.on('room:create', (payload, ack) => {
      if (!parse(emptySchema, payload ?? {}))
        return error(ack, 'INVALID_PAYLOAD', 'Invalid payload');
      if (!createLimiter.take(ip)) return error(ack, 'RATE_LIMITED', 'Too many rooms created');
      const res = rooms.createRoom();
      if (!res.ok) return error(ack, res.code, res.message);
      reply(ack, { ok: true, data: res.data });
    });

    socket.on('room:peek', (payload, ack) => {
      const data = parse(roomPeekSchema, payload);
      if (!data) return error(ack, 'INVALID_PAYLOAD', 'Invalid room code');
      if (!peekLimiter.take(ip)) return error(ack, 'RATE_LIMITED', 'Too many requests');
      reply(ack, { ok: true, data: rooms.peek(data.code) });
    });

    socket.on('room:join', async (payload, ack) => {
      const data = parse(roomJoinSchema, payload);
      if (!data) return error(ack, 'INVALID_PAYLOAD', 'Invalid join request');
      if (!joinLimiter.take(ip)) return error(ack, 'RATE_LIMITED', 'Too many join attempts');
      const iceServers = await getIceServers();
      if (socket.disconnected) return;
      const res = rooms.join({ ...data, socketId: socket.id });
      if (!res.ok) return error(ack, res.code, res.message);

      const { replacedSocketId, ...rest } = res.data;
      if (replacedSocketId && replacedSocketId !== socket.id) {
        io.sockets.sockets.get(replacedSocketId)?.disconnect(true);
      }
      void socket.join(channel(data.code));
      reply(ack, { ok: true, data: { ...rest, iceServers } });
    });

    socket.on('room:leave', (ack) => {
      const me = self();
      if (me) {
        rooms.leave(me.participantId, 'left');
        void socket.leave(channel(me.code));
      }
      reply(ack, { ok: true, data: null });
    });

    socket.on('room:end', (ack) => {
      const me = self();
      if (!me) return error(ack, 'NOT_IN_ROOM', 'Not in a room');
      const role = rooms
        .snapshot(me.code)
        ?.participants.find((p) => p.id === me.participantId)?.role;
      if (role !== 'host') return error(ack, 'FORBIDDEN', 'Only the host can end the room');
      reply(ack, { ok: true, data: null });
      rooms.endRoom(me.code, 'ended-by-host');
    });

    socket.on('room:kick', (payload, ack) => {
      const me = self();
      const data = parse(kickSchema, payload);
      if (!me) return error(ack, 'NOT_IN_ROOM', 'Not in a room');
      if (!data) return error(ack, 'INVALID_PAYLOAD', 'Invalid payload');
      const res = rooms.kick(me.participantId, data.participantId);
      if (!res.ok) return error(ack, res.code, res.message);
      if (res.data.socketId) io.to(res.data.socketId).emit('room:ended', { reason: 'kicked' });
      reply(ack, { ok: true, data: null });
    });

    // ── WebRTC signaling relay ─────────────────────────────────────────────
    const relayDescription = (event: 'webrtc:offer' | 'webrtc:answer') => (payload: unknown) => {
      const me = self();
      const data = parse(descriptionRelaySchema, payload);
      if (!me || !data) return;
      const target = rooms.relayTarget(me.participantId, data.to);
      if (target)
        io.to(target).emit(event, {
          from: me.participantId,
          gen: data.gen,
          description: data.description,
        });
    };
    socket.on('webrtc:offer', relayDescription('webrtc:offer'));
    socket.on('webrtc:answer', relayDescription('webrtc:answer'));
    socket.on('webrtc:ice-candidate', (payload) => {
      const me = self();
      const data = parse(candidateRelaySchema, payload);
      if (!me || !data) return;
      const target = rooms.relayTarget(me.participantId, data.to);
      if (target) {
        io.to(target).emit('webrtc:ice-candidate', {
          from: me.participantId,
          gen: data.gen,
          candidate: data.candidate,
        });
      }
    });

    // ── Media state ────────────────────────────────────────────────────────
    socket.on('screen:start', (ack) => {
      const me = self();
      if (!me) return error(ack, 'NOT_IN_ROOM', 'Not in a room');
      const res = rooms.startScreen(me.participantId);
      if (!res.ok) return error(ack, res.code, res.message);
      reply(ack, { ok: true, data: null });
    });
    socket.on('screen:stop', () => {
      const me = self();
      if (me) rooms.stopScreen(me.participantId);
    });
    socket.on('screen:pause', (payload) => {
      const me = self();
      const data = parse(screenPauseSchema, payload);
      if (me && data) rooms.pauseScreen(me.participantId, data.paused);
    });
    socket.on('audio:state', (payload) => {
      const me = self();
      const data = parse(audioStateSchema, payload);
      if (me && data) rooms.setMicMuted(me.participantId, data.micMuted);
    });
    socket.on('connection:state', (payload) => {
      const me = self();
      const data = parse(connectionStateSchema, payload);
      if (me && data) rooms.setQuality(me.participantId, data.quality);
    });

    socket.on('disconnect', () => rooms.disconnect(socket.id));
  });

  return () => {
    createLimiter.dispose();
    joinLimiter.dispose();
    peekLimiter.dispose();
  };
}
