import { cameraConstraints, contentHintFor, type ScreenSettings } from '@/lib/quality';
import { PICKER_TIMEOUT_MS, type CaptureResult } from './screenCapture';

const VIRTUAL_CAMERA = /obs|virtual/i;

async function findVirtualCamera(): Promise<MediaDeviceInfo | null> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.find((d) => d.kind === 'videoinput' && VIRTUAL_CAMERA.test(d.label)) ?? null;
}

async function openVirtualCamera(settings: ScreenSettings): Promise<MediaStream | null> {
  let device = await findVirtualCamera();
  if (!device) {
    // Device labels stay hidden until camera access is granted once.
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    probe.getTracks().forEach((t) => t.stop());
    device = await findVirtualCamera();
  }
  if (!device) return null;
  return navigator.mediaDevices.getUserMedia({
    video: { ...cameraConstraints(settings), deviceId: { exact: device.deviceId } },
    audio: false,
  });
}

/**
 * Shares the OBS virtual camera as the screen. A fallback for systems where the browser's
 * own screen capture fails, such as Windows builds without Windows.Graphics.Capture.
 */
export async function captureVirtualCamera(settings: ScreenSettings): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
    return { ok: false, reason: 'error', error: 'screen-unsupported' };
  }

  let timer = 0;
  let timedOut = false;
  const request = openVirtualCamera(settings);
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      timedOut = true;
      reject(new DOMException('Permission prompt timed out', 'TimeoutError'));
    }, PICKER_TIMEOUT_MS);
  });

  try {
    const stream = await Promise.race([request, timeout]);
    const track = stream?.getVideoTracks()[0];
    if (!stream || !track) {
      stream?.getTracks().forEach((t) => t.stop());
      return { ok: false, reason: 'error', error: 'virtual-camera-missing' };
    }
    track.contentHint = contentHintFor(settings.optimization);
    return { ok: true, stream, track, surface: 'virtual-camera' };
  } catch (err) {
    if (timedOut) {
      void request.then((s) => s?.getTracks().forEach((t) => t.stop())).catch(() => undefined);
      return { ok: false, reason: 'error', error: 'screen-timeout' };
    }
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError')
      return { ok: false, reason: 'error', error: 'virtual-camera-blocked' };
    if (name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'error', error: 'virtual-camera-missing' };
  } finally {
    window.clearTimeout(timer);
  }
}
