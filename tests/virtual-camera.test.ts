import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenSettings } from '../client/src/lib/quality';

const settings: ScreenSettings = { quality: '1080p', fps: 30, optimization: 'detail' };

function cameraStream(deviceId: string) {
  const track = { stop: vi.fn(), contentHint: '', getSettings: () => ({ deviceId }) };
  return { track, stream: { getVideoTracks: () => [track], getTracks: () => [track] } };
}

const device = (deviceId: string, label: string) => ({ kind: 'videoinput', deviceId, label });

beforeEach(() => {
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('virtual camera capture', () => {
  it('opens the OBS virtual camera at the configured quality', async () => {
    const { stream, track } = cameraStream('obs');
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: async () => [
          device('cam', 'HD Webcam'),
          device('obs', 'OBS Virtual Camera'),
        ],
      },
    });
    const { captureVirtualCamera } = await import('../client/src/services/media/virtualCamera');
    const result = await captureVirtualCamera(settings);
    expect(result).toMatchObject({ ok: true, track, surface: 'virtual-camera' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0]?.[0]).toMatchObject({
      video: { deviceId: { exact: 'obs' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
  });

  it('asks for camera access once to reveal device labels', async () => {
    const probe = cameraStream('cam');
    const obs = cameraStream('obs');
    let granted = false;
    const getUserMedia = vi.fn(async () => {
      if (granted) return obs.stream;
      granted = true;
      return probe.stream;
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: async () =>
          granted ? [device('obs', 'OBS Virtual Camera')] : [device('obs', '')],
      },
    });
    const { captureVirtualCamera } = await import('../client/src/services/media/virtualCamera');
    const result = await captureVirtualCamera(settings);
    expect(probe.track.stop).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, track: obs.track });
  });

  it('explains how to start OBS when no virtual camera exists', async () => {
    const probe = cameraStream('cam');
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: async () => probe.stream,
        enumerateDevices: async () => [device('cam', 'HD Webcam')],
      },
    });
    const { captureVirtualCamera } = await import('../client/src/services/media/virtualCamera');
    expect(await captureVirtualCamera(settings)).toEqual({
      ok: false,
      reason: 'error',
      error: 'virtual-camera-missing',
    });
    expect(probe.track.stop).toHaveBeenCalled();
  });

  it('reports a denied camera permission', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
        enumerateDevices: async () => [device('obs', 'OBS Virtual Camera')],
      },
    });
    const { captureVirtualCamera } = await import('../client/src/services/media/virtualCamera');
    expect(await captureVirtualCamera(settings)).toMatchObject({
      ok: false,
      error: 'virtual-camera-blocked',
    });
  });
});
