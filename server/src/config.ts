import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ABSOLUTE_MAX_PARTICIPANTS, DEFAULT_MAX_PARTICIPANTS, type IceServer } from '@scxn/shared';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function list(name: string, fallback = ''): string[] {
  return (process.env[name] ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function iceServers(): IceServer[] {
  const servers: IceServer[] = [];
  const stun = list('STUN_URLS', 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478');
  if (stun.length) servers.push({ urls: stun });
  const turn = list('TURN_URLS');
  if (turn.length) {
    servers.push({
      urls: turn,
      username: process.env.TURN_USERNAME ?? '',
      credential: process.env.TURN_CREDENTIAL ?? '',
    });
  }
  return servers;
}

function cloudflareTurn(): { keyId: string; token: string } | null {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
  return keyId && token ? { keyId, token } : null;
}

export const config = {
  port: int('PORT', 3001, 1, 65535),
  production: process.env.NODE_ENV === 'production',
  corsOrigins: list('CORS_ORIGINS'),
  trustProxy: process.env.TRUST_PROXY === '1',
  maxParticipants: int('MAX_PARTICIPANTS', DEFAULT_MAX_PARTICIPANTS, 2, ABSOLUTE_MAX_PARTICIPANTS),
  maxRooms: int('MAX_ROOMS', 500, 1, 100_000),
  reconnectGraceMs: int('RECONNECT_GRACE_MS', 30_000, 1_000, 300_000),
  /** A freshly created room that nobody joins disappears after this. */
  unusedRoomTtlMs: 10 * 60_000,
  /** An emptied room stays joinable this long (e.g. everyone refreshed). */
  emptyRoomTtlMs: 5 * 60_000,
  /** Ended codes keep answering "room ended" instead of "not found" for this long. */
  endedRoomMemoryMs: 60 * 60_000,
  iceServers: iceServers(),
  cloudflareTurn: cloudflareTurn(),
} as const;

export type ServerConfig = typeof config;
