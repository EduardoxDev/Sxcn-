import { EventEmitter } from 'node:events';
import {
  generateRoomCode,
  type ErrorCode,
  type LeaveReason,
  type LinkQuality,
  type Participant,
  type RoomEndReason,
  type RoomPeekResult,
  type RoomSnapshot,
} from '@scxn/shared';
import { randomId } from '../lib/ids';

export interface RoomManagerOptions {
  maxParticipants: number;
  maxRooms: number;
  reconnectGraceMs: number;
  unusedRoomTtlMs: number;
  emptyRoomTtlMs: number;
  endedRoomMemoryMs: number;
}

interface ParticipantRecord {
  data: Participant;
  resumeToken: string;
  ownsRoom: boolean;
  socketId: string | null;
  graceTimer: NodeJS.Timeout | null;
}

interface Room {
  code: string;
  createdAt: number;
  hostKey: string;
  participants: Map<string, ParticipantRecord>;
  sharerId: string | null;
  expiryTimer: NodeJS.Timeout | null;
}

export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

const fail = (
  code: ErrorCode,
  message: string,
): { ok: false; code: ErrorCode; message: string } => ({
  ok: false,
  code,
  message,
});

export interface JoinInput {
  code: string;
  name: string;
  micMuted: boolean;
  socketId: string;
  resumeToken?: string;
  hostKey?: string;
}

export interface JoinOutput {
  self: Participant;
  room: RoomSnapshot;
  resumeToken: string;
  resumed: boolean;
  /** Socket that previously held this seat (stale tab / dead transport) — should be dropped. */
  replacedSocketId: string | null;
}

/** Domain events. The socket layer turns these into broadcasts. */
export interface RoomManagerEvents {
  joined: [{ code: string; participant: Participant; socketId: string }];
  updated: [{ code: string; participant: Participant }];
  left: [{ code: string; participantId: string; reason: LeaveReason; socketId: string | null }];
  screen: [{ code: string; participantId: string; active: boolean }];
  ended: [{ code: string; reason: RoomEndReason; socketIds: string[] }];
}

/**
 * In-memory source of truth for rooms and presence. Pure domain logic — it knows nothing about
 * Socket.IO, which keeps it unit-testable and makes a future Redis-backed implementation a
 * drop-in replacement.
 */
export class RoomManager extends EventEmitter<RoomManagerEvents> {
  private readonly rooms = new Map<string, Room>();
  private readonly ended = new Map<string, number>();
  private readonly participantRoom = new Map<string, string>();
  private readonly socketParticipant = new Map<string, string>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(private readonly options: RoomManagerOptions) {
    super();
    this.sweepTimer = setInterval(() => this.sweepEnded(), 60_000);
    this.sweepTimer.unref();
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  get roomCount(): number {
    return this.rooms.size;
  }

  peek(code: string): RoomPeekResult {
    const room = this.rooms.get(code);
    return {
      exists: Boolean(room),
      ended: !room && this.ended.has(code),
      full: room ? room.participants.size >= this.options.maxParticipants : false,
      participantCount: room?.participants.size ?? 0,
      maxParticipants: this.options.maxParticipants,
    };
  }

  participantForSocket(socketId: string): { participantId: string; code: string } | null {
    const participantId = this.socketParticipant.get(socketId);
    if (!participantId) return null;
    const code = this.participantRoom.get(participantId);
    return code ? { participantId, code } : null;
  }

  /** Socket id of `toId`, if both participants share a room and the target is connected. */
  relayTarget(fromId: string, toId: string): string | null {
    if (fromId === toId) return null;
    const code = this.participantRoom.get(fromId);
    if (!code || this.participantRoom.get(toId) !== code) return null;
    return this.rooms.get(code)?.participants.get(toId)?.socketId ?? null;
  }

  snapshot(code: string): RoomSnapshot | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return {
      code: room.code,
      createdAt: room.createdAt,
      maxParticipants: this.options.maxParticipants,
      sharerId: room.sharerId,
      participants: [...room.participants.values()].map((p) => ({ ...p.data })),
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  createRoom(): Result<{ code: string; hostKey: string }> {
    if (this.rooms.size >= this.options.maxRooms) {
      return fail('ROOM_LIMIT', 'Server is at capacity');
    }
    let code = generateRoomCode();
    while (this.rooms.has(code) || this.ended.has(code)) code = generateRoomCode();
    const room: Room = {
      code,
      createdAt: Date.now(),
      hostKey: randomId(24),
      participants: new Map(),
      sharerId: null,
      expiryTimer: null,
    };
    this.rooms.set(code, room);
    this.scheduleExpiry(room, this.options.unusedRoomTtlMs);
    return { ok: true, data: { code, hostKey: room.hostKey } };
  }

  join(input: JoinInput): Result<JoinOutput> {
    const room = this.rooms.get(input.code);
    if (!room) {
      return this.ended.has(input.code)
        ? fail('ROOM_ENDED', 'Room has ended')
        : fail('ROOM_NOT_FOUND', 'Room not found');
    }
    const existingId = this.socketParticipant.get(input.socketId);
    if (existingId) {
      const existing = room.participants.get(existingId);
      if (existing) {
        return {
          ok: true,
          data: {
            self: { ...existing.data },
            room: this.snapshot(room.code)!,
            resumeToken: existing.resumeToken,
            resumed: true,
            replacedSocketId: null,
          },
        };
      }
      return fail('ALREADY_IN_ROOM', 'Socket already joined a room');
    }

    // Resume an existing seat (network blip, page refresh).
    if (input.resumeToken) {
      const record = [...room.participants.values()].find(
        (p) => p.resumeToken === input.resumeToken,
      );
      if (record) {
        const replacedSocketId = record.socketId;
        if (replacedSocketId) this.socketParticipant.delete(replacedSocketId);
        if (record.graceTimer) clearTimeout(record.graceTimer);
        record.graceTimer = null;
        record.socketId = input.socketId;
        record.data.presence = 'online';
        record.data.name = input.name;
        record.data.micMuted = input.micMuted;
        this.socketParticipant.set(input.socketId, record.data.id);
        this.clearExpiry(room);
        this.emit('updated', { code: room.code, participant: { ...record.data } });
        return {
          ok: true,
          data: {
            self: { ...record.data },
            room: this.snapshot(room.code)!,
            resumeToken: record.resumeToken,
            resumed: true,
            replacedSocketId,
          },
        };
      }
    }

    if (room.participants.size >= this.options.maxParticipants) {
      return fail('ROOM_FULL', 'Room is full');
    }

    const participant: Participant = {
      id: randomId(9),
      name: input.name,
      role: 'participant',
      micMuted: input.micMuted,
      screen: 'none',
      presence: 'online',
      quality: 'unknown',
      joinedAt: Date.now(),
    };
    const record: ParticipantRecord = {
      data: participant,
      resumeToken: randomId(24),
      ownsRoom: input.hostKey !== undefined && input.hostKey === room.hostKey,
      socketId: input.socketId,
      graceTimer: null,
    };
    room.participants.set(participant.id, record);
    this.participantRoom.set(participant.id, room.code);
    this.socketParticipant.set(input.socketId, participant.id);
    this.clearExpiry(room);

    const roleChanges = this.recomputeHost(room);
    this.emit('joined', {
      code: room.code,
      participant: { ...participant },
      socketId: input.socketId,
    });
    for (const changed of roleChanges) {
      if (changed.id !== participant.id)
        this.emit('updated', { code: room.code, participant: { ...changed } });
    }

    return {
      ok: true,
      data: {
        self: { ...participant },
        room: this.snapshot(room.code)!,
        resumeToken: record.resumeToken,
        resumed: false,
        replacedSocketId: null,
      },
    };
  }

  leave(participantId: string, reason: LeaveReason = 'left'): void {
    const code = this.participantRoom.get(participantId);
    const room = code ? this.rooms.get(code) : undefined;
    const record = room?.participants.get(participantId);
    if (!room || !record) return;

    if (record.graceTimer) clearTimeout(record.graceTimer);
    if (record.socketId) this.socketParticipant.delete(record.socketId);
    room.participants.delete(participantId);
    this.participantRoom.delete(participantId);

    if (room.sharerId === participantId) {
      room.sharerId = null;
      this.emit('screen', { code: room.code, participantId, active: false });
    }
    this.emit('left', { code: room.code, participantId, reason, socketId: record.socketId });

    for (const changed of this.recomputeHost(room)) {
      this.emit('updated', { code: room.code, participant: { ...changed } });
    }
    if (room.participants.size === 0) this.scheduleExpiry(room, this.options.emptyRoomTtlMs);
  }

  /** Transport dropped: keep the seat for a grace period so the client can resume. */
  disconnect(socketId: string): void {
    const participantId = this.socketParticipant.get(socketId);
    if (!participantId) return;
    this.socketParticipant.delete(socketId);
    const code = this.participantRoom.get(participantId);
    const record = code ? this.rooms.get(code)?.participants.get(participantId) : undefined;
    if (!code || !record || record.socketId !== socketId) return;

    record.socketId = null;
    record.data.presence = 'reconnecting';
    this.emit('updated', { code, participant: { ...record.data } });
    record.graceTimer = setTimeout(
      () => this.leave(participantId, 'timeout'),
      this.options.reconnectGraceMs,
    );
    record.graceTimer.unref?.();
  }

  endRoom(code: string, reason: RoomEndReason): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const socketIds: string[] = [];
    for (const record of room.participants.values()) {
      if (record.graceTimer) clearTimeout(record.graceTimer);
      if (record.socketId) {
        socketIds.push(record.socketId);
        this.socketParticipant.delete(record.socketId);
      }
      this.participantRoom.delete(record.data.id);
    }
    this.clearExpiry(room);
    this.rooms.delete(code);
    this.ended.set(code, Date.now());
    this.emit('ended', { code, reason, socketIds });
  }

  /** Host-only. Returns the kicked participant's socket so it can be notified. */
  kick(byId: string, targetId: string): Result<{ socketId: string | null }> {
    const room = this.roomOf(byId);
    if (!room) return fail('NOT_IN_ROOM', 'Not in a room');
    if (room.participants.get(byId)?.data.role !== 'host')
      return fail('FORBIDDEN', 'Only the host can do that');
    const target = room.participants.get(targetId);
    if (!target || targetId === byId) return fail('INVALID_PAYLOAD', 'Unknown participant');
    const socketId = target.socketId;
    this.leave(targetId, 'kicked');
    return { ok: true, data: { socketId } };
  }

  // ── Participant state ──────────────────────────────────────────────────────

  setMicMuted(participantId: string, micMuted: boolean): void {
    this.patch(participantId, (p) =>
      p.micMuted === micMuted ? false : ((p.micMuted = micMuted), true),
    );
  }

  setQuality(participantId: string, quality: LinkQuality): void {
    this.patch(participantId, (p) =>
      p.quality === quality ? false : ((p.quality = quality), true),
    );
  }

  startScreen(participantId: string): Result<null> {
    const room = this.roomOf(participantId);
    const record = room?.participants.get(participantId);
    if (!room || !record) return fail('NOT_IN_ROOM', 'Not in a room');
    if (room.sharerId && room.sharerId !== participantId) {
      const sharer = room.participants.get(room.sharerId)?.data.name ?? 'Alguém';
      return fail('SCREEN_BUSY', `${sharer} is already sharing`);
    }
    if (room.sharerId === participantId && record.data.screen !== 'none')
      return { ok: true, data: null };
    room.sharerId = participantId;
    record.data.screen = 'sharing';
    this.emit('screen', { code: room.code, participantId, active: true });
    this.emit('updated', { code: room.code, participant: { ...record.data } });
    return { ok: true, data: null };
  }

  stopScreen(participantId: string): void {
    const room = this.roomOf(participantId);
    const record = room?.participants.get(participantId);
    if (!room || !record || room.sharerId !== participantId) return;
    room.sharerId = null;
    record.data.screen = 'none';
    this.emit('screen', { code: room.code, participantId, active: false });
    this.emit('updated', { code: room.code, participant: { ...record.data } });
  }

  pauseScreen(participantId: string, paused: boolean): void {
    const room = this.roomOf(participantId);
    if (!room || room.sharerId !== participantId) return;
    const next = paused ? 'paused' : 'sharing';
    this.patch(participantId, (p) => (p.screen === next ? false : ((p.screen = next), true)));
  }

  dispose(): void {
    clearInterval(this.sweepTimer);
    for (const room of this.rooms.values()) {
      this.clearExpiry(room);
      for (const record of room.participants.values())
        if (record.graceTimer) clearTimeout(record.graceTimer);
    }
    this.rooms.clear();
    this.removeAllListeners();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private roomOf(participantId: string): Room | undefined {
    const code = this.participantRoom.get(participantId);
    return code ? this.rooms.get(code) : undefined;
  }

  private patch(participantId: string, mutate: (p: Participant) => boolean): void {
    const room = this.roomOf(participantId);
    const record = room?.participants.get(participantId);
    if (!room || !record) return;
    if (mutate(record.data))
      this.emit('updated', { code: room.code, participant: { ...record.data } });
  }

  /**
   * Host = the room owner (holder of the host key) if present, otherwise the longest-standing
   * participant. Returns participants whose role changed.
   */
  private recomputeHost(room: Room): Participant[] {
    const records = [...room.participants.values()];
    if (records.length === 0) return [];
    const host = records.reduce((best, r) => {
      if (r.ownsRoom !== best.ownsRoom) return r.ownsRoom ? r : best;
      return r.data.joinedAt < best.data.joinedAt ? r : best;
    });
    const changed: Participant[] = [];
    for (const r of records) {
      const role = r === host ? 'host' : 'participant';
      if (r.data.role !== role) {
        r.data.role = role;
        changed.push(r.data);
      }
    }
    return changed;
  }

  private scheduleExpiry(room: Room, ms: number): void {
    this.clearExpiry(room);
    room.expiryTimer = setTimeout(() => {
      if (room.participants.size === 0) this.endRoom(room.code, 'expired');
    }, ms);
    room.expiryTimer.unref?.();
  }

  private clearExpiry(room: Room): void {
    if (room.expiryTimer) clearTimeout(room.expiryTimer);
    room.expiryTimer = null;
  }

  private sweepEnded(): void {
    const cutoff = Date.now() - this.options.endedRoomMemoryMs;
    for (const [code, at] of this.ended) if (at < cutoff) this.ended.delete(code);
  }
}
