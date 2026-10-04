import { create } from 'zustand';
import type { LinkQuality } from '@scxn/shared';
import type { AppErrorKind } from '@/lib/errors';

export type MicStatus =
  'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'busy' | 'error' | 'none';
export type ScreenShareStatus = 'idle' | 'requesting' | 'sharing' | 'paused' | 'ended' | 'error';
export type PeerState = RTCPeerConnectionState | 'recovering';

export interface PeerStats {
  rttMs: number | null;
  lossPct: number | null;
  quality: LinkQuality;
  /** Inbound screen video from this peer. */
  video: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    codec: string | null;
  } | null;
  /** Outbound screen video to this peer (when we share). */
  outbound: {
    bitrate: number;
    fps: number;
    width: number;
    height: number;
    limitation: string | null;
  } | null;
}

interface RemoteMedia {
  audio: MediaStream | null;
  screen: MediaStream | null;
}

interface MediaState {
  mic: {
    status: MicStatus;
    muted: boolean;
    stream: MediaStream | null;
    deviceLabel: string | null;
  };
  screen: {
    status: ScreenShareStatus;
    stream: MediaStream | null;
    error: AppErrorKind | null;
    surface: string | null;
  };
  remote: Record<string, RemoteMedia>;
  peerStates: Record<string, PeerState>;
  speaking: Record<string, boolean>;
  stats: Record<string, PeerStats>;
  localQuality: LinkQuality;

  setMic: (patch: Partial<MediaState['mic']>) => void;
  setScreen: (patch: Partial<MediaState['screen']>) => void;
  setRemote: (id: string, patch: Partial<RemoteMedia>) => void;
  setPeerState: (id: string, state: PeerState) => void;
  setSpeaking: (id: string, speaking: boolean) => void;
  setStats: (stats: Record<string, PeerStats>, localQuality: LinkQuality) => void;
  forgetPeer: (id: string) => void;
  resetSession: () => void;
}

const omit = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in record)) return record;
  const { [key]: _gone, ...rest } = record;
  return rest;
};

export const useMedia = create<MediaState>()((set) => ({
  mic: { status: 'idle', muted: false, stream: null, deviceLabel: null },
  screen: { status: 'idle', stream: null, error: null, surface: null },
  remote: {},
  peerStates: {},
  speaking: {},
  stats: {},
  localQuality: 'unknown',

  setMic: (patch) => set((s) => ({ mic: { ...s.mic, ...patch } })),
  setScreen: (patch) => set((s) => ({ screen: { ...s.screen, ...patch } })),
  setRemote: (id, patch) =>
    set((s) => ({
      remote: { ...s.remote, [id]: { audio: null, screen: null, ...s.remote[id], ...patch } },
    })),
  setPeerState: (id, state) =>
    set((s) => (s.peerStates[id] === state ? s : { peerStates: { ...s.peerStates, [id]: state } })),
  setSpeaking: (id, speaking) =>
    set((s) =>
      Boolean(s.speaking[id]) === speaking ? s : { speaking: { ...s.speaking, [id]: speaking } },
    ),
  setStats: (stats, localQuality) => set({ stats, localQuality }),
  forgetPeer: (id) =>
    set((s) => ({
      remote: omit(s.remote, id),
      peerStates: omit(s.peerStates, id),
      speaking: omit(s.speaking, id),
      stats: omit(s.stats, id),
    })),
  resetSession: () =>
    set({
      screen: { status: 'idle', stream: null, error: null, surface: null },
      remote: {},
      peerStates: {},
      speaking: {},
      stats: {},
      localQuality: 'unknown',
    }),
}));
