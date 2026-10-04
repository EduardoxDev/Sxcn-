import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  peers: [] as Array<{ setScreen: ReturnType<typeof vi.fn> }>,
}));
vi.mock('../client/src/services/signaling/SignalingClient', () => ({
  signaling: {
    connected: true,
    connect: vi.fn(async () => {}),
    request: mocks.request,
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  },
}));
vi.mock('../client/src/services/webrtc/PeerManager', () => ({
  PeerManager: class {
    peerIds: string[] = [];
    setScreen = vi.fn(async () => {});
    setAudioTrack = vi.fn(async () => {});
    setIceServers = vi.fn();
    recoverAll = vi.fn();
    connect = vi.fn();
    dispose = vi.fn();
    constructor() {
      mocks.peers.push(this);
    }
  },
}));
vi.mock('../client/src/services/webrtc/StatsMonitor', () => ({
  StatsMonitor: class {
    start() {}
    stop() {}
  },
}));
vi.mock('../client/src/services/media/SpeakingDetector', () => ({
  SpeakingDetector: class {
    track() {}
    untrack() {}
    dispose() {}
  },
}));
vi.mock('../client/src/lib/notify', () => ({
  notify: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  mocks.peers.length = 0;
  mocks.request.mockReset();
  vi.stubGlobal('window', {
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});
function joinResult(id: string) {
  const self = {
    id,
    name: 'Host',
    role: 'host',
    micMuted: true,
    screen: 'none',
    presence: 'online',
    quality: 'unknown',
    joinedAt: 0,
  };
  return {
    self,
    room: { code: 'HG3V-WPST', participants: [self], sharerId: null, maxParticipants: 8 },
    resumeToken: 'test',
    iceServers: [],
  };
}

it('reattaches the ongoing screen when a reconnect creates a new participant identity', async () => {
  let identity = 'before';
  mocks.request.mockImplementation(async (event) =>
    event === 'room:join' ? joinResult(identity) : null,
  );
  const track = {
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: () => ({}),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn(async () => stream) } });
  const { RoomSession } = await import('../client/src/services/session/RoomSession');
  const session = new RoomSession('HG3V-WPST', 'Host');
  try {
    await session.join();
    await session.startScreen();
    expect(mocks.peers[0]?.setScreen).toHaveBeenCalledWith(expect.objectContaining({ track }));
    identity = 'after';
    session.retry();
    await vi.waitFor(() => expect(mocks.peers).toHaveLength(2));
    expect(mocks.peers[1]?.setScreen).toHaveBeenCalledWith(expect.objectContaining({ track }));
  } finally {
    session.dispose();
  }
});

it('disposes immediately while the leave acknowledgement is still pending', async () => {
  let acknowledge!: (value: unknown) => void;
  mocks.request.mockImplementation((event) =>
    event === 'room:leave'
      ? new Promise((r) => {
          acknowledge = r;
        })
      : Promise.resolve(joinResult('before')),
  );
  const { RoomSession } = await import('../client/src/services/session/RoomSession');
  const session = new RoomSession('HG3V-WPST', 'Host');
  await session.join();
  const pending = session.leave();
  expect(session.active).toBe(false);
  acknowledge(null);
  await pending;
});

it('reports a display capture that the system ends right after it starts', async () => {
  mocks.request.mockImplementation(async (event) =>
    event === 'room:join' ? joinResult('host') : null,
  );
  const listeners: Record<string, () => void> = {};
  const track = {
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = cb;
    }),
    getSettings: () => ({ displaySurface: 'monitor' }),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn(async () => stream) } });
  const { RoomSession } = await import('../client/src/services/session/RoomSession');
  const { useMedia } = await import('../client/src/stores/mediaStore');
  const session = new RoomSession('HG3V-WPST', 'Host');
  try {
    await session.join();
    await session.startScreen();
    listeners.ended?.();
    expect(useMedia.getState().screen).toMatchObject({
      status: 'error',
      error: 'screen-interrupted',
    });
  } finally {
    session.dispose();
  }
});
