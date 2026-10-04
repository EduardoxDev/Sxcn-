import { getAudioContext, readLevel } from './audioContext';

interface Source {
  stream: MediaStream;
  node: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array<ArrayBuffer>;
  speaking: boolean;
  lastLoud: number;
}

const THRESHOLD = 0.018;
const HOLD_MS = 450;
const TICK_MS = 100;

/**
 * Local voice-activity detection for every audio stream in the room (own mic + remotes).
 * Runs client-side, so "speaking" needs no signaling traffic. Only state transitions are
 * reported, which keeps React renders to a minimum.
 */
export class SpeakingDetector {
  private sources = new Map<string, Source>();
  private timer: number | null = null;

  constructor(private readonly onChange: (id: string, speaking: boolean) => void) {}

  track(id: string, stream: MediaStream | null): void {
    const existing = this.sources.get(id);
    if (existing?.stream === stream) return;
    this.untrack(id);
    if (!stream || stream.getAudioTracks().length === 0) return;
    try {
      const ctx = getAudioContext();
      const node = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      node.connect(analyser);
      this.sources.set(id, {
        stream,
        node,
        analyser,
        buffer: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
        speaking: false,
        lastLoud: 0,
      });
      this.ensureRunning();
    } catch (err) {
      console.warn('[speaking] cannot analyse stream', err);
    }
  }

  untrack(id: string): void {
    const s = this.sources.get(id);
    if (!s) return;
    s.node.disconnect();
    this.sources.delete(id);
    if (s.speaking) this.onChange(id, false);
    if (this.sources.size === 0) this.stop();
  }

  dispose(): void {
    for (const id of [...this.sources.keys()]) this.untrack(id);
    this.stop();
  }

  private ensureRunning(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const now = performance.now();
    for (const [id, s] of this.sources) {
      const enabled = s.stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live');
      const level = enabled ? readLevel(s.analyser, s.buffer) : 0;
      if (level > THRESHOLD) s.lastLoud = now;
      const speaking = now - s.lastLoud < HOLD_MS;
      if (speaking !== s.speaking) {
        s.speaking = speaking;
        this.onChange(id, speaking);
      }
    }
  }
}
