import { create } from 'zustand';
import type { Participant, RoomEndReason, RoomSnapshot } from '@scxn/shared';
import type { AppErrorKind } from '@/lib/errors';

/**
 * Session lifecycle:
 *   idle → joining → joined ⇄ reconnecting → (disconnected | ended | error)
 */
export type SessionStatus =
  'idle' | 'joining' | 'joined' | 'reconnecting' | 'disconnected' | 'ended' | 'error';

interface RoomState {
  status: SessionStatus;
  code: string | null;
  selfId: string | null;
  participants: Record<string, Participant>;
  sharerId: string | null;
  maxParticipants: number;
  error: AppErrorKind | null;
  endReason: RoomEndReason | null;

  reset: () => void;
  setStatus: (status: SessionStatus) => void;
  fail: (error: AppErrorKind) => void;
  end: (reason: RoomEndReason) => void;
  applySnapshot: (selfId: string, room: RoomSnapshot) => void;
  upsertParticipant: (p: Participant) => void;
  removeParticipant: (id: string) => void;
  setSharer: (id: string | null) => void;
}

const initial = {
  status: 'idle' as SessionStatus,
  code: null,
  selfId: null,
  participants: {},
  sharerId: null,
  maxParticipants: 8,
  error: null,
  endReason: null,
};

export const useRoom = create<RoomState>()((set) => ({
  ...initial,
  reset: () => set(initial),
  setStatus: (status) => set({ status }),
  fail: (error) => set({ status: 'error', error }),
  end: (endReason) => set({ status: 'ended', endReason }),
  applySnapshot: (selfId, room) =>
    set({
      selfId,
      code: room.code,
      sharerId: room.sharerId,
      maxParticipants: room.maxParticipants,
      participants: Object.fromEntries(room.participants.map((p) => [p.id, p])),
      error: null,
    }),
  upsertParticipant: (p) => set((s) => ({ participants: { ...s.participants, [p.id]: p } })),
  removeParticipant: (id) =>
    set((s) => {
      if (!s.participants[id]) return s;
      const { [id]: _removed, ...rest } = s.participants;
      return { participants: rest, sharerId: s.sharerId === id ? null : s.sharerId };
    }),
  setSharer: (sharerId) => set({ sharerId }),
}));

/** Participants ordered: you first, then host, then by join time. */
export function sortParticipants(list: Participant[], selfId: string | null): Participant[] {
  return [...list].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
    return a.joinedAt - b.joinedAt;
  });
}
