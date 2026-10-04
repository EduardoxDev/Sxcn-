import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, type Result } from '../server/src/rooms/RoomManager';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, sanitizeName } from '@scxn/shared';

const managers: RoomManager[] = [];
function manager() {
  const m = new RoomManager({
    maxParticipants: 2,
    maxRooms: 3,
    reconnectGraceMs: 1000,
    unusedRoomTtlMs: 5000,
    emptyRoomTtlMs: 5000,
    endedRoomMemoryMs: 60000,
  });
  managers.push(m);
  return m;
}
function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.code);
  return r.data;
}
afterEach(() => {
  managers.forEach((m) => m.dispose());
  managers.length = 0;
  vi.useRealTimers();
});

describe('room domain', () => {
  it('resumes a seat in a full room, then expires it and transfers host', () => {
    vi.useFakeTimers();
    const m = manager();
    const room = unwrap(m.createRoom());
    const host = unwrap(m.join({ ...room, name: 'Host', micMuted: true, socketId: 'a' }));
    const guest = unwrap(m.join({ code: room.code, name: 'Guest', micMuted: true, socketId: 'b' }));
    expect(m.join({ code: room.code, name: 'Extra', micMuted: true, socketId: 'c' })).toMatchObject(
      { ok: false, code: 'ROOM_FULL' },
    );
    m.disconnect('a');
    const resumed = unwrap(
      m.join({
        code: room.code,
        name: 'Host',
        micMuted: false,
        socketId: 'a2',
        resumeToken: host.resumeToken,
      }),
    );
    expect(resumed.self.id).toBe(host.self.id);
    expect(resumed.resumed).toBe(true);
    m.disconnect('a2');
    vi.advanceTimersByTime(1001);
    expect(m.snapshot(room.code)?.participants).toMatchObject([
      { id: guest.self.id, role: 'host' },
    ]);
  });
  it('enforces one screen and isolates relays between rooms', () => {
    const m = manager();
    const room = unwrap(m.createRoom());
    const other = unwrap(m.createRoom());
    const a = unwrap(m.join({ ...room, name: 'A', micMuted: true, socketId: 'a' }));
    const b = unwrap(m.join({ code: room.code, name: 'B', micMuted: true, socketId: 'b' }));
    const c = unwrap(m.join({ ...other, name: 'C', micMuted: true, socketId: 'c' }));
    expect(m.startScreen(a.self.id).ok).toBe(true);
    expect(m.startScreen(b.self.id)).toMatchObject({ ok: false, code: 'SCREEN_BUSY' });
    expect(m.relayTarget(a.self.id, b.self.id)).toBe('b');
    expect(m.relayTarget(a.self.id, c.self.id)).toBeNull();
    expect(m.kick(b.self.id, a.self.id)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    m.stopScreen(a.self.id);
    expect(m.startScreen(b.self.id).ok).toBe(true);
    expect(m.kick(a.self.id, b.self.id).ok).toBe(true);
    expect(m.snapshot(room.code)?.sharerId).toBeNull();
    m.endRoom(room.code, 'ended-by-host');
    expect(m.peek(room.code).ended).toBe(true);
  });
  it('expires unused rooms', () => {
    vi.useFakeTimers();
    const m = manager();
    const r = unwrap(m.createRoom());
    vi.advanceTimersByTime(5001);
    expect(m.peek(r.code).ended).toBe(true);
  });
});

describe('user input', () => {
  it('accepts pasted invitations and rejects ambiguous codes', () => {
    expect(normalizeRoomCode('https://example.test/room/hg3v-wpst')).toBe('HG3V-WPST');
    expect(normalizeRoomCode(' hg3v wpst ')).toBe('HG3V-WPST');
    expect(normalizeRoomCode('OOOO-1111')).toBeNull();
    for (let i = 0; i < 100; i++) expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });
  it('cleans invisible controls and limits unicode names', () => {
    expect(sanitizeName(' <Ana>\u202e  Silva ')).toBe('Ana Silva');
    expect(Array.from(sanitizeName('😀'.repeat(30)))).toHaveLength(24);
  });
});
