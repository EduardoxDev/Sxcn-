import type { IceCandidatePayload, SessionDescriptionPayload } from '@scxn/shared';
import { PeerLink, type OutgoingSignal } from './PeerLink';

export interface PeerManagerHooks {
  send: (to: string, generation: number, signal: OutgoingSignal) => void;
  onAudio: (peerId: string, stream: MediaStream | null) => void;
  onScreen: (peerId: string, stream: MediaStream | null) => void;
  onState: (peerId: string, state: RTCPeerConnectionState | 'recovering') => void;
}

interface LocalScreen {
  track: MediaStreamTrack;
  encoding: (viewers: number) => RTCRtpEncodingParameters;
  degradation: RTCDegradationPreference;
}

/** How long a failed/disconnected link gets to heal (ICE restart) before it is rebuilt. */
const RECOVERY_TIMEOUT_MS = 12_000;

/**
 * Full-mesh manager: one PeerLink per remote participant.
 *
 * Link identity: every PeerLink has a monotonic `generation`. Signals carry the sender's
 * generation; when a newer remote generation shows up (peer refreshed or rebuilt its link),
 * we rebuild ours to match, and anything older is dropped as stale.
 */
export class PeerManager {
  private links = new Map<string, PeerLink>();
  private recoveryTimers = new Map<string, number>();
  private audio: { track: MediaStreamTrack | null; stream: MediaStream | null } = {
    track: null,
    stream: null,
  };
  private screen: LocalScreen | null = null;
  private disposed = false;

  constructor(
    private readonly selfId: string,
    private iceServers: RTCIceServer[],
    private readonly hooks: PeerManagerHooks,
  ) {}

  get peerIds(): string[] {
    return [...this.links.keys()];
  }

  get(peerId: string): PeerLink | undefined {
    return this.links.get(peerId);
  }

  setIceServers(servers: RTCIceServer[]): void {
    this.iceServers = servers;
  }

  /** Creates a link to `peerId` if none exists. Both sides call this; perfect negotiation sorts it out. */
  connect(peerId: string): PeerLink {
    return this.links.get(peerId) ?? this.create(peerId);
  }

  remove(peerId: string): void {
    this.clearRecovery(peerId);
    const link = this.links.get(peerId);
    if (!link) return;
    link.close();
    this.links.delete(peerId);
    this.hooks.onAudio(peerId, null);
    this.hooks.onScreen(peerId, null);
    this.updateScreenEncodings();
  }

  async handleDescription(
    from: string,
    generation: number,
    description: SessionDescriptionPayload,
  ): Promise<void> {
    const link = this.resolve(from, generation, description.type === 'offer');
    if (!link) return;
    try {
      await link.handleDescription(description);
    } catch (err) {
      console.warn('[webrtc] failed to apply remote description', err);
      // A broken negotiation is unrecoverable on this link; rebuild from the impolite side.
      if (!link.polite) this.rebuild(from);
    }
  }

  async handleCandidate(
    from: string,
    generation: number,
    candidate: IceCandidatePayload,
  ): Promise<void> {
    const link = this.links.get(from);
    if (!link || link.remoteGeneration !== generation) return;
    await link.handleCandidate(candidate);
  }

  async setAudioTrack(track: MediaStreamTrack | null, stream: MediaStream | null): Promise<void> {
    this.audio = { track, stream };
    await Promise.all([...this.links.values()].map((l) => l.setAudioTrack(track, stream)));
  }

  async setScreen(screen: LocalScreen | null): Promise<void> {
    this.screen = screen;
    const viewers = this.links.size;
    await Promise.all(
      [...this.links.values()].map((l) =>
        l.setScreenTrack(
          screen?.track ?? null,
          screen?.encoding(viewers) ?? null,
          screen?.degradation ?? 'balanced',
        ),
      ),
    );
  }

  /** Re-applies bitrate ceilings (audience size or quality preset changed). */
  updateScreenEncodings(screen?: Partial<LocalScreen>): void {
    if (!this.screen) return;
    this.screen = { ...this.screen, ...screen };
    const viewers = this.links.size;
    for (const l of this.links.values()) {
      void l.applyEncoding(this.screen.encoding(viewers), this.screen.degradation);
    }
  }

  /** After a signaling outage: heal links that did not survive on their own. */
  recoverAll(): void {
    for (const [peerId, link] of this.links) {
      if (link.connectionState === 'connected') continue;
      if (link.polite) link.restartIce();
      else this.rebuild(peerId);
    }
  }

  rebuild(peerId: string): void {
    if (this.disposed) return;
    const old = this.links.get(peerId);
    old?.close();
    this.links.delete(peerId);
    this.clearRecovery(peerId);
    this.hooks.onScreen(peerId, null);
    this.create(peerId);
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.links.keys()]) this.remove(id);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private create(peerId: string, generation?: number): PeerLink {
    const link: PeerLink = new PeerLink(
      peerId,
      this.selfId < peerId,
      this.iceServers,
      {
        signal: (signal) => this.hooks.send(peerId, link.generation, signal),
        audio: (stream) => this.hooks.onAudio(peerId, stream),
        screen: (stream) => this.hooks.onScreen(peerId, stream),
        state: (state) => this.onLinkState(peerId, link, state),
      },
      generation,
    );
    this.links.set(peerId, link);
    // Attach current local media; this triggers the first negotiation.
    void link.setAudioTrack(this.audio.track, this.audio.stream);
    if (this.screen) {
      void link.setScreenTrack(
        this.screen.track,
        this.screen.encoding(this.links.size),
        this.screen.degradation,
      );
    }
    this.updateScreenEncodings();
    this.hooks.onState(peerId, 'new');
    return link;
  }

  /** Finds (or rebuilds) the link that a signal with `generation` belongs to. */
  private resolve(from: string, generation: number, isOffer: boolean): PeerLink | null {
    let link = this.links.get(from);
    let localGeneration: number | undefined;
    if (link && link.remoteGeneration !== null) {
      if (generation < link.remoteGeneration) return null; // stale
      if (generation > link.remoteGeneration) {
        // Remote rebuilt its connection. Only an offer can start a new session.
        if (!isOffer) return null;
        // Following a remote rebuild is not another local restart. Preserve our wire
        // generation, otherwise both sides keep interpreting the reply as a new restart.
        localGeneration = link.generation;
        link.close();
        this.clearRecovery(from);
        this.links.delete(from);
        this.hooks.onScreen(from, null);
        link = undefined;
      }
    }
    if (!link) link = this.create(from, localGeneration);
    link.remoteGeneration = generation;
    return link;
  }

  private onLinkState(peerId: string, link: PeerLink, state: RTCPeerConnectionState): void {
    if (this.links.get(peerId) !== link) return;
    if (state === 'connected') {
      this.clearRecovery(peerId);
      this.hooks.onState(peerId, state);
      return;
    }
    if (state === 'failed' || state === 'disconnected') {
      this.hooks.onState(peerId, 'recovering');
      if (state === 'failed') link.restartIce();
      if (!this.recoveryTimers.has(peerId)) {
        const timer = window.setTimeout(() => {
          this.recoveryTimers.delete(peerId);
          const current = this.links.get(peerId);
          if (current && current.connectionState !== 'connected') {
            // The impolite side rebuilds; the polite side follows via the generation check.
            if (!current.polite) this.rebuild(peerId);
            else current.restartIce();
          }
        }, RECOVERY_TIMEOUT_MS);
        this.recoveryTimers.set(peerId, timer);
      }
      return;
    }
    this.hooks.onState(peerId, state);
  }

  private clearRecovery(peerId: string): void {
    const t = this.recoveryTimers.get(peerId);
    if (t !== undefined) window.clearTimeout(t);
    this.recoveryTimers.delete(peerId);
  }
}
