import { useMedia, type MicStatus } from '@/stores/mediaStore';

type MicListener = (track: MediaStreamTrack | null, stream: MediaStream | null) => void;

function statusFromError(err: unknown): MicStatus {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'error';
}

/**
 * Owns the local microphone. Shared by pre-join (preview/test) and the room, so the user is
 * prompted once and the same track flows into the call. Mute uses `track.enabled` — no
 * renegotiation, instant.
 */
class MicrophoneController {
  private stream: MediaStream | null = null;
  private listeners = new Set<MicListener>();
  private acquiring: Promise<void> | null = null;
  private epoch = 0;
  private selectedDeviceId: string | null = null;

  get track(): MediaStreamTrack | null {
    return this.stream?.getAudioTracks()[0] ?? null;
  }

  get currentStream(): MediaStream | null {
    return this.stream;
  }

  get deviceId(): string | null {
    return this.track?.getSettings().deviceId ?? null;
  }

  onTrackChange(listener: MicListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async acquire(deviceId?: string | null): Promise<void> {
    const epoch = this.epoch;
    if (this.acquiring) await this.acquiring.catch(() => undefined);
    if (epoch !== this.epoch) return;
    if (
      this.stream &&
      this.selectedDeviceId === (deviceId || null) &&
      this.track?.readyState === 'live'
    )
      return;
    const pending = this.open(deviceId ?? null, epoch);
    this.acquiring = pending;
    try {
      await this.acquiring;
    } finally {
      if (this.acquiring === pending) this.acquiring = null;
    }
  }

  private async open(deviceId: string | null, epoch: number): Promise<void> {
    const store = useMedia.getState();
    if (!navigator.mediaDevices?.getUserMedia) {
      store.setMic({ status: 'unavailable' });
      return;
    }
    store.setMic({ status: 'requesting' });
    const audio: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
    let next: MediaStream;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = navigator.mediaDevices.getUserMedia({ audio, video: false });
      void request
        .then((stream) => {
          if (timedOut || epoch !== this.epoch) stream.getTracks().forEach((t) => t.stop());
        })
        .catch(() => undefined);
      next = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new DOMException('Microphone permission timed out', 'TimeoutError'));
          }, 30_000);
        }),
      ]);
    } catch (err) {
      if (epoch !== this.epoch) return;
      // A remembered device may have been unplugged — fall back to the default once.
      if (deviceId && err instanceof DOMException && err.name === 'OverconstrainedError') {
        return this.open(null, epoch);
      }
      store.setMic({ status: statusFromError(err) });
      if (!this.stream) store.setMic({ stream: null });
      return;
    } finally {
      clearTimeout(timer);
    }

    if (epoch !== this.epoch) {
      next.getTracks().forEach((t) => t.stop());
      return;
    }

    const previous = this.stream;
    this.stream = next;
    this.selectedDeviceId = deviceId;
    const track = next.getAudioTracks()[0] ?? null;
    if (track) {
      track.enabled = !useMedia.getState().mic.muted;
      track.addEventListener('ended', () => {
        if (this.track === track) {
          this.stream = null;
          useMedia.getState().setMic({ status: 'error', stream: null, deviceLabel: null });
          this.emit();
        }
      });
    }
    store.setMic({ status: 'ready', stream: next, deviceLabel: track?.label || null });
    this.emit();
    previous?.getTracks().forEach((t) => t.stop());
  }

  setMuted(muted: boolean): void {
    if (this.track) this.track.enabled = !muted;
    useMedia.getState().setMic({ muted });
  }

  /** Listen-only mode: the user chose to join without a microphone. */
  markNone(): void {
    this.release();
    useMedia.getState().setMic({ status: 'none', muted: true });
  }

  release(): void {
    this.epoch++;
    this.acquiring = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    useMedia.getState().setMic({ stream: null, status: 'idle', deviceLabel: null });
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l(this.track, this.stream);
  }
}

export const microphone = new MicrophoneController();
