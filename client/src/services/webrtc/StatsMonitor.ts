import type { LinkQuality } from '@scxn/shared';
import type { PeerStats } from '@/stores/mediaStore';
import type { PeerManager } from './PeerManager';

interface Counters {
  at: number;
  inVideoBytes: number;
  outVideoBytes: number;
  packetsReceived: number;
  packetsLost: number;
}

const INTERVAL_MS = 2000;

export function classify(rttMs: number | null, lossPct: number | null): LinkQuality {
  if (rttMs == null && lossPct == null) return 'unknown';
  if ((rttMs ?? 0) > 400 || (lossPct ?? 0) > 8) return 'poor';
  if ((rttMs ?? 0) > 200 || (lossPct ?? 0) > 3) return 'fair';
  return 'good';
}

const RANK: Record<LinkQuality, number> = { unknown: 0, good: 1, fair: 2, poor: 3 };

/** Polls getStats() on every link: RTT, loss, inbound/outbound screen video metrics. */
export class StatsMonitor {
  private timer: number | null = null;
  private previous = new Map<string, Counters>();

  constructor(
    private readonly peers: PeerManager,
    private readonly onStats: (stats: Record<string, PeerStats>, local: LinkQuality) => void,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => void this.sample(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.previous.clear();
  }

  private async sample(): Promise<void> {
    const result: Record<string, PeerStats> = {};
    let worst: LinkQuality = 'unknown';

    await Promise.all(
      this.peers.peerIds.map(async (peerId) => {
        const link = this.peers.get(peerId);
        if (!link || link.connectionState !== 'connected') return;
        let report: RTCStatsReport;
        try {
          report = await link.pc.getStats();
        } catch {
          return;
        }
        const stats = this.parse(peerId, report);
        result[peerId] = stats;
        if (RANK[stats.quality] > RANK[worst]) worst = stats.quality;
      }),
    );

    for (const id of this.previous.keys()) if (!(id in result)) this.previous.delete(id);
    this.onStats(result, worst);
  }

  private parse(peerId: string, report: RTCStatsReport): PeerStats {
    const now = performance.now();
    let rtt: number | null = null;
    let inVideoBytes = 0;
    let outVideoBytes = 0;
    let packetsReceived = 0;
    let packetsLost = 0;
    let video: PeerStats['video'] = null;
    let outbound: PeerStats['outbound'] = null;
    const codecs = new Map<string, string>();

    report.forEach((s: Record<string, unknown> & { type: string; id: string }) => {
      if (s.type === 'codec')
        codecs.set(s.id, String(s.mimeType ?? '').replace(/^video\/|^audio\//, ''));
    });

    report.forEach((s: Record<string, unknown> & { type: string }) => {
      if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated || s.selected)) {
        if (typeof s.currentRoundTripTime === 'number') rtt = s.currentRoundTripTime * 1000;
      }
      if (s.type === 'inbound-rtp') {
        packetsReceived += Number(s.packetsReceived ?? 0);
        packetsLost += Math.max(0, Number(s.packetsLost ?? 0));
        if (s.kind === 'video' && Number(s.framesDecoded ?? 0) > 0) {
          inVideoBytes += Number(s.bytesReceived ?? 0);
          video = {
            width: Number(s.frameWidth ?? 0),
            height: Number(s.frameHeight ?? 0),
            fps: Number(s.framesPerSecond ?? 0),
            bitrate: 0,
            codec: codecs.get(String(s.codecId)) ?? null,
          };
        }
      }
      if (s.type === 'outbound-rtp' && s.kind === 'video' && Number(s.bytesSent ?? 0) > 0) {
        outVideoBytes += Number(s.bytesSent ?? 0);
        outbound = {
          bitrate: 0,
          fps: Number(s.framesPerSecond ?? 0),
          width: Number(s.frameWidth ?? 0),
          height: Number(s.frameHeight ?? 0),
          limitation:
            typeof s.qualityLimitationReason === 'string' && s.qualityLimitationReason !== 'none'
              ? s.qualityLimitationReason
              : null,
        };
      }
    });

    const prev = this.previous.get(peerId);
    let lossPct: number | null = null;
    if (prev) {
      const seconds = (now - prev.at) / 1000;
      const v = video as PeerStats['video'];
      const o = outbound as PeerStats['outbound'];
      if (v && seconds > 0)
        v.bitrate = Math.max(0, ((inVideoBytes - prev.inVideoBytes) * 8) / seconds);
      if (o && seconds > 0)
        o.bitrate = Math.max(0, ((outVideoBytes - prev.outVideoBytes) * 8) / seconds);
      const received = packetsReceived - prev.packetsReceived;
      const lost = packetsLost - prev.packetsLost;
      if (received + lost > 0) lossPct = (Math.max(0, lost) / (received + lost)) * 100;
    }
    this.previous.set(peerId, {
      at: now,
      inVideoBytes,
      outVideoBytes,
      packetsReceived,
      packetsLost,
    });

    return { rttMs: rtt, lossPct, quality: classify(rtt, lossPct), video, outbound };
  }
}
