import type { AppErrorKind } from '@/lib/errors';
import { captureConstraints, contentHintFor, type ScreenSettings } from '@/lib/quality';

/** The picker can stay open while the user decides; past this we give up cleanly. */
export const PICKER_TIMEOUT_MS = 90_000;

export type CaptureResult =
  | { ok: true; stream: MediaStream; track: MediaStreamTrack; surface: string | null }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; error: AppErrorKind };

/**
 * Opens the browser's screen picker (monitor, window or tab). Always explicit, always
 * user-initiated — this is only ever called from a click or the S shortcut.
 */
export async function captureScreen(settings: ScreenSettings): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return { ok: false, reason: 'error', error: 'screen-unsupported' };
  }

  const options = {
    video: { ...captureConstraints(settings), cursor: 'always' },
    audio: false,
    // Chromium hints: offer every surface type, never the Scxn tab itself.
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions;

  let timer = 0;
  let timedOut = false;
  const request = navigator.mediaDevices.getDisplayMedia(options);
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      timedOut = true;
      reject(new DOMException('Picker timed out', 'TimeoutError'));
    }, PICKER_TIMEOUT_MS);
  });

  try {
    const stream = await Promise.race([request, timeout]);
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return { ok: false, reason: 'error', error: 'unknown' };
    }
    track.contentHint = contentHintFor(settings.optimization);
    const surface =
      (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface ??
      null;
    return { ok: true, stream, track, surface };
  } catch (err) {
    if (timedOut) {
      // If the user picks something after we gave up, release it immediately.
      void request.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
      return { ok: false, reason: 'error', error: 'screen-timeout' };
    }
    const name = err instanceof DOMException ? err.name : '';
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (name === 'NotAllowedError') {
      // Chrome/Firefox use NotAllowedError both for "user cancelled" and "OS denied".
      return message.includes('system') || message.includes('policy')
        ? { ok: false, reason: 'error', error: 'screen-blocked' }
        : { ok: false, reason: 'cancelled' };
    }
    if (name === 'AbortError') return { ok: false, reason: 'cancelled' };
    if (name === 'NotSupportedError' || name === 'TypeError') {
      return { ok: false, reason: 'error', error: 'screen-unsupported' };
    }
    if (name === 'NotReadableError') return { ok: false, reason: 'error', error: 'screen-blocked' };
    return { ok: false, reason: 'error', error: 'unknown' };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function applyCaptureSettings(
  track: MediaStreamTrack,
  settings: ScreenSettings,
): Promise<void> {
  track.contentHint = contentHintFor(settings.optimization);
  try {
    await track.applyConstraints(captureConstraints(settings));
  } catch (err) {
    console.warn('[screen] applyConstraints failed', err);
  }
}
