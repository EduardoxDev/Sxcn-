import { afterEach, beforeEach, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createScxnServer, type ScxnServer } from '../server/src/app';
import { config } from '../server/src/config';
import type { Ack, CreateRoomResult, JoinResult } from '@scxn/shared';

let server: ScxnServer;
let url: string;
const clients: Socket[] = [];
beforeEach(async () => {
  server = createScxnServer({ ...config, maxParticipants: 2, iceServers: [] });
  await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const address = server.http.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  clients.forEach((s) => s.disconnect());
  clients.length = 0;
  await server.close();
});
async function client() {
  const s = io(url, { transports: ['websocket'], forceNew: true });
  clients.push(s);
  await new Promise<void>((resolve, reject) => {
    s.on('connect', resolve);
    s.on('connect_error', reject);
  });
  return s;
}
async function request<T>(s: Socket, event: string, ...args: unknown[]): Promise<T> {
  const res = (await s.timeout(2000).emitWithAck(event, ...args)) as Ack<T>;
  if (!res.ok) throw new Error(res.error.code);
  return res.data;
}

it('creates, joins, shares, rejects unauthorized control and ends a real room', async () => {
  const a = await client();
  const b = await client();
  const room = await request<CreateRoomResult>(a, 'room:create', {});
  const host = await request<JoinResult>(a, 'room:join', { ...room, name: 'Host', micMuted: true });
  const guest = await request<JoinResult>(b, 'room:join', {
    code: room.code,
    name: '<Guest>\u202e',
    micMuted: true,
  });
  expect(guest.self.name).toBe('Guest');
  expect(host.self.role).toBe('host');
  await expect(request(b, 'room:end')).rejects.toThrow('FORBIDDEN');
  const screen = new Promise((resolve) => b.once('screen:start', resolve));
  await request(a, 'screen:start');
  expect(await screen).toEqual({ participantId: host.self.id });
  await expect(request(b, 'screen:start')).rejects.toThrow('SCREEN_BUSY');
  const ended = new Promise((resolve) => b.once('room:ended', resolve));
  await request(a, 'room:end');
  expect(await ended).toEqual({ reason: 'ended-by-host' });
  await expect(
    request(b, 'room:join', { code: room.code, name: 'Guest', micMuted: true }),
  ).rejects.toThrow('ROOM_ENDED');
});

it('makes a same-socket join retry idempotent when the first acknowledgement was lost', async () => {
  const a = await client();
  const room = await request<CreateRoomResult>(a, 'room:create', {});
  const payload = { ...room, name: 'Host', micMuted: true };
  const first = await request<JoinResult>(a, 'room:join', payload);
  const retried = await request<JoinResult>(a, 'room:join', payload);
  expect(retried.self.id).toBe(first.self.id);
  expect(retried.room.participants).toHaveLength(1);
});

it('validates payloads and throttles repeated room creation', async () => {
  const a = await client();
  await expect(
    request(a, 'room:join', { code: 'garbage', name: '', micMuted: 'no' }),
  ).rejects.toThrow('INVALID_PAYLOAD');
  for (let i = 0; i < 6; i++) await request(a, 'room:create', {});
  await expect(request(a, 'room:create', {})).rejects.toThrow('RATE_LIMITED');
});
