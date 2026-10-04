import type { IceCandidatePayload, SessionDescriptionPayload } from '@scxn/shared';

export type OutgoingSignal =
  | { kind: 'description'; description: SessionDescriptionPayload }
  | { kind: 'candidate'; candidate: IceCandidatePayload };

export interface PeerLinkEvents {
  signal: (signal: OutgoingSignal) => void;
  audio: (stream: MediaStream | null) => void;
  screen: (stream: MediaStream | null) => void;
  state: (state: RTCPeerConnectionState) => void;
}

// Monotonic across page reloads (wall-clock based) so peers can tell a fresh connection from
// a stale one even when the same participant id resumes after a refresh.
let generationCounter = Date.now() * 1000;
const nextGeneration = () => ++generationCounter;

/**
 * One RTCPeerConnection to one remote participant, implementing the W3C "perfect negotiation"
 * pattern: both sides may renegotiate at any time (mic switch, screen start/stop) and offer
 * collisions are resolved deterministically by the `polite` flag.
 *
 * Media layout: an audio sender (mic) and a dedicated video transceiver for the screen, which
 * is reused across share sessions via replaceTrack + direction changes to keep the SDP small.
 */
export class PeerLink {
  readonly pc: RTCPeerConnection;
  /** Generation of the remote RTCPeerConnection this link is bound to. */
  remoteGeneration: number | null = null;

  private makingOffer = false;
  private settingRemoteAnswer = false;
  private ignoreOffer = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private audioSender: RTCRtpSender | null = null;
  private screenTransceiver: RTCRtpTransceiver | null = null;
  private closed = false;

  constructor(
    readonly peerId: string,
    readonly polite: boolean,
    iceServers: RTCIceServer[],
    private readonly events: PeerLinkEvents,
    readonly generation = nextGeneration(),
  ) {
    this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
    // Reserve the same media slots on both peers, including listen-only participants.
    // A refreshed listener must still send an offer so the other side can replace its
    // old connection; replaceTrack then reuses these slots for every share session.
    this.audioSender = this.pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    this.screenTransceiver = this.pc.addTransceiver('video', { direction: 'sendrecv' });

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        const local = this.pc.localDescription;
        if (local && (local.type === 'offer' || local.type === 'answer')) {
          this.events.signal({
            kind: 'description',
            description: { type: local.type, sdp: local.sdp },
          });
        }
      } catch (err) {
        console.warn('[webrtc] negotiation failed', err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const json = candidate.toJSON();
      this.events.signal({
        kind: 'candidate',
        candidate: {
          candidate: json.candidate ?? '',
          sdpMid: json.sdpMid ?? null,
          sdpMLineIndex: json.sdpMLineIndex ?? null,
          usernameFragment: json.usernameFragment ?? null,
        },
      });
    };

    this.pc.ontrack = ({ track, streams }) => {
      if (track.kind === 'audio') {
        this.events.audio(streams[0] ?? new MediaStream([track]));
      } else {
        this.events.screen(new MediaStream([track]));
      }
    };

    this.pc.onconnectionstatechange = () => this.events.state(this.pc.connectionState);

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'failed') this.pc.restartIce();
    };
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  // ── Incoming signaling ─────────────────────────────────────────────────────

  async handleDescription(description: SessionDescriptionPayload): Promise<void> {
    if (this.closed) return;
    const collision =
      description.type === 'offer' &&
      (this.makingOffer || (this.pc.signalingState !== 'stable' && !this.settingRemoteAnswer));
    this.ignoreOffer = !this.polite && collision;
    if (this.ignoreOffer) return;

    // Modern browsers perform the implicit rollback for the polite peer here.
    this.settingRemoteAnswer = description.type === 'answer';
    try {
      await this.pc.setRemoteDescription(description);
    } finally {
      this.settingRemoteAnswer = false;
    }
    await this.flushCandidates();
    if (description.type === 'offer') {
      await this.pc.setLocalDescription();
      const local = this.pc.localDescription;
      if (local && local.type === 'answer') {
        this.events.signal({
          kind: 'description',
          description: { type: 'answer', sdp: local.sdp },
        });
      }
    }
  }

  async handleCandidate(candidate: IceCandidatePayload): Promise<void> {
    if (this.closed || !candidate || !candidate.candidate) return;
    const init: RTCIceCandidateInit = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      usernameFragment: candidate.usernameFragment ?? null,
    };
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(init);
      return;
    }
    try {
      await this.pc.addIceCandidate(init);
    } catch (err) {
      if (!this.ignoreOffer) console.warn('[webrtc] addIceCandidate failed', err);
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* stale candidate from a previous negotiation — safe to drop */
      }
    }
  }

  // ── Local media ────────────────────────────────────────────────────────────

  async setAudioTrack(track: MediaStreamTrack | null, stream: MediaStream | null): Promise<void> {
    if (this.closed) return;
    if (this.audioSender) {
      await this.audioSender.replaceTrack(track);
    } else if (track && stream) {
      this.audioSender = this.pc.addTrack(track, stream);
    }
  }

  async setScreenTrack(
    track: MediaStreamTrack | null,
    encoding: RTCRtpEncodingParameters | null,
    degradation: RTCDegradationPreference,
  ): Promise<void> {
    if (this.closed) return;
    if (track) {
      if (this.screenTransceiver) {
        await this.screenTransceiver.sender.replaceTrack(track);
        this.screenTransceiver.direction = 'sendrecv';
      } else {
        this.screenTransceiver = this.pc.addTransceiver(track, { direction: 'sendrecv' });
      }
      if (encoding) await this.applyEncoding(encoding, degradation);
    } else if (this.screenTransceiver) {
      await this.screenTransceiver.sender.replaceTrack(null);
      // Stops RTP on our side; the remote track is muted/ended, signaling clears the UI.
      this.screenTransceiver.direction = 'sendrecv';
    }
  }

  async applyEncoding(
    encoding: RTCRtpEncodingParameters,
    degradation: RTCDegradationPreference,
  ): Promise<void> {
    const sender = this.screenTransceiver?.sender;
    if (!sender?.track) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0] = { ...params.encodings[0], ...encoding };
      (
        params as RTCRtpSendParameters & { degradationPreference?: RTCDegradationPreference }
      ).degradationPreference = degradation;
      await sender.setParameters(params);
    } catch (err) {
      // Not fatal: some browsers reject degradationPreference or params before negotiation.
      console.warn('[webrtc] setParameters failed', err);
    }
  }

  restartIce(): void {
    if (!this.closed) this.pc.restartIce();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.close();
  }
}
