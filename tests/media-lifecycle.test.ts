import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.useRealTimers();
});

describe('microphone lifecycle', () => {
  it('switches from an explicit microphone back to the system default', async () => {
    const track = {
      readyState: 'live',
      stop: vi.fn(),
      addEventListener: vi.fn(),
      getSettings: () => ({ deviceId: 'usb' }),
    };
    const getUserMedia = vi.fn(async () => ({
      getAudioTracks: () => [track],
      getTracks: () => [track],
    }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const { microphone } = await import('../client/src/services/media/microphone');
    await microphone.acquire('usb');
    await microphone.acquire(null);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1]?.[0]).not.toHaveProperty('audio.deviceId');
    microphone.release();
  });
  it('stops a late permission result after leaving pre-join', async () => {
    let allow!: (stream: unknown) => void;
    const stop = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((r) => {
            allow = r;
          }),
      },
    });
    const { microphone } = await import('../client/src/services/media/microphone');
    const { useMedia } = await import('../client/src/stores/mediaStore');
    const pending = microphone.acquire();
    microphone.release();
    allow({
      getTracks: () => [{ stop }],
      getAudioTracks: () => [{ stop, getSettings: () => ({}), addEventListener: vi.fn() }],
    });
    await pending;
    expect(stop).toHaveBeenCalled();
    expect(microphone.currentStream).toBeNull();
    expect(useMedia.getState().mic.status).toBe('idle');
  });

  it('ends the requesting state if the permission prompt is ignored', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    const { microphone } = await import('../client/src/services/media/microphone');
    const { useMedia } = await import('../client/src/stores/mediaStore');
    const pending = microphone.acquire();
    await vi.advanceTimersByTimeAsync(30000);
    expect(useMedia.getState().mic.status).toBe('error');
    await pending;
  });
});

describe('peer recovery', () => {
  it('keeps its generation when following a remote rebuild to avoid an offer loop', async () => {
    class FakePC {
      signalingState = 'stable';
      connectionState = 'new';
      localDescription = null;
      setRemoteDescription = vi.fn(async () => {});
      setLocalDescription = vi.fn(async () => {});
      close = vi.fn();
      addTransceiver = vi.fn(() => ({ sender: { replaceTrack: vi.fn(async () => {}) } }));
    }
    vi.stubGlobal('RTCPeerConnection', FakePC);
    const { PeerManager } = await import('../client/src/services/webrtc/PeerManager');
    const peers = new PeerManager('a', [], {
      send: vi.fn(),
      onAudio: vi.fn(),
      onScreen: vi.fn(),
      onState: vi.fn(),
    });
    const first = peers.connect('b');
    await peers.handleDescription('b', 10, { type: 'offer', sdp: '' });
    await peers.handleDescription('b', 11, { type: 'offer', sdp: '' });
    expect(peers.get('b')).not.toBe(first);
    expect(peers.get('b')?.generation).toBe(first.generation);
    peers.dispose();
  });
});
