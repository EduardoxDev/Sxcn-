import type { LinkQuality, Participant, RoomEndReason } from '@scxn/shared';
import { ERROR_COPY, kindFromServerCode, SignalingError } from '@/lib/errors';
import { notify } from '@/lib/notify';
import { degradationFor, encodingFor, type ScreenSettings } from '@/lib/quality';
import { roomSecrets } from '@/lib/storage';
import { useMedia } from '@/stores/mediaStore';
import { useRoom } from '@/stores/roomStore';
import { useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { microphone } from '../media/microphone';
import { applyCaptureSettings, captureScreen } from '../media/screenCapture';
import { SpeakingDetector } from '../media/SpeakingDetector';
import { signaling } from '../signaling/SignalingClient';
import { PeerManager } from '../webrtc/PeerManager';
import { StatsMonitor } from '../webrtc/StatsMonitor';

/** After this long without signaling we stop silently retrying and ask the user. */
const RECONNECT_WINDOW_MS = 30_000;

const screenSettings = (): ScreenSettings => {
  const s = useSettings.getState();
  return { quality: s.quality, fps: s.fps, optimization: s.optimization };
};

/**
 * Orchestrates one room session: signaling events ⇄ stores ⇄ WebRTC mesh ⇄ local media.
 * UI components never touch sockets or peer connections — they read stores and call these methods.
 */
export class RoomSession {
  private peers: PeerManager | null = null;
  private stats: StatsMonitor | null = null;
  private readonly speaking = new SpeakingDetector((id, on) =>
    useMedia.getState().setSpeaking(id, on),
  );
  private offs: Array<() => void> = [];
  private screen: { stream: MediaStream; track: MediaStreamTrack } | null = null;
  private reconnectTimer: number | null = null;
  private endedTimer: number | null = null;
  private reportedQuality: LinkQuality = 'unknown';
  private pendingQuality: LinkQuality = 'unknown';
  private joinInFlight = false;
  private disposed = false;

  constructor(
    readonly code: string,
    private name: string,
  ) {}

  get active(): boolean {
    return !this.disposed;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async join(): Promise<void> {
    const room = useRoom.getState();
    room.reset();
    useMedia.getState().resetSession();
    useRoom.setState({ status: 'joining', code: this.code });
    this.bindSignaling();
    this.bindMicrophone();
    try {
      await signaling.connect();
    } catch {
      if (!this.disposed) useRoom.getState().fail('signaling-failed');
      return;
    }
    await this.requestJoin(false);
  }

  /** User-triggered retry from the reconnect / error banners. */
  retry(): void {
    if (this.disposed) return;
    useRoom.getState().setStatus('reconnecting');
    this.armReconnectWindow();
    if (signaling.connected) void this.requestJoin(true);
    else signaling.socket.connect();
  }

  async leave(): Promise<void> {
    if (this.disposed) return;
    this.stopScreen({ silent: true, notifyServer: true });
    // Release capture immediately; a missing server acknowledgement must never keep
    // the microphone running or allow a pending picker to start sharing after exit.
    this.dispose();
    microphone.release();
    try {
      if (signaling.connected) await signaling.request('room:leave');
    } catch {
      /* leaving anyway */
    }
    roomSecrets.clearResumeToken(this.code);
    useRoom.getState().reset();
  }

  async endForEveryone(): Promise<void> {
    try {
      await signaling.request('room:end');
    } catch (err) {
      notify.error(
        'Não foi possível encerrar a sala',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async kick(participantId: string): Promise<void> {
    try {
      await signaling.request('room:kick', { participantId });
    } catch {
      notify.error('Não foi possível remover o participante');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.offs.forEach((off) => off());
    this.offs = [];
    this.clearReconnectWindow();
    if (this.endedTimer !== null) window.clearTimeout(this.endedTimer);
    this.stats?.stop();
    this.peers?.dispose();
    this.peers = null;
    this.speaking.dispose();
    this.screen?.stream.getTracks().forEach((t) => t.stop());
    this.screen = null;
    useMedia.getState().resetSession();
  }

  // ── Join / resume ──────────────────────────────────────────────────────────

  private async requestJoin(resume: boolean): Promise<void> {
    if (this.disposed || this.joinInFlight) return;
    this.joinInFlight = true;
    const media = useMedia.getState();
    try {
      const res = await signaling.request('room:join', {
        code: this.code,
        name: this.name,
        micMuted: media.mic.muted || media.mic.status !== 'ready',
        resumeToken: roomSecrets.getResumeToken(this.code),
        hostKey: roomSecrets.getHostKey(this.code),
      });
      if (this.disposed) return;

      const previousSelfId = useRoom.getState().selfId;
      roomSecrets.setResumeToken(this.code, res.resumeToken);
      useRoom.getState().applySnapshot(res.self.id, res.room);

      if (this.peers && previousSelfId && previousSelfId !== res.self.id) {
        this.stats?.stop();
        this.peers.dispose();
        this.peers = null;
      }
      if (!this.peers) {
        this.peers = this.createPeerManager(res.self.id, res.iceServers);
        this.stats = new StatsMonitor(this.peers, (s, q) => this.onStats(s, q));
        void this.peers.setAudioTrack(microphone.track, microphone.currentStream);
        if (this.screen) {
          const settings = screenSettings();
          await this.peers.setScreen({
            track: this.screen.track,
            encoding: (viewers) => encodingFor(settings, viewers),
            degradation: degradationFor(settings.optimization),
          });
        }
        this.speaking.track(res.self.id, microphone.currentStream);
      } else {
        this.peers.setIceServers(res.iceServers);
      }

      const others = new Set(
        res.room.participants.filter((p) => p.id !== res.self.id).map((p) => p.id),
      );
      for (const id of this.peers.peerIds) if (!others.has(id)) this.dropPeer(id);
      for (const id of others) this.peers.connect(id);
      if (resume) this.peers.recoverAll();

      this.reconcile(res.self);
      this.clearReconnectWindow();
      useRoom.getState().setStatus('joined');
      this.stats?.start();
    } catch (err) {
      if (this.disposed) return;
      const code = err instanceof SignalingError ? err.code : 'INTERNAL';
      if (code === 'ROOM_ENDED' || (resume && code === 'ROOM_NOT_FOUND')) {
        this.handleEnded('expired');
      } else if (code === 'TIMEOUT' || code === 'DISCONNECTED') {
        // Transport trouble — the reconnect flow takes over.
        if (resume) useRoom.getState().setStatus('reconnecting');
        else useRoom.getState().fail('signaling-failed');
      } else {
        useRoom.getState().fail(kindFromServerCode(code));
      }
    } finally {
      this.joinInFlight = false;
    }
  }

  /** After a resume, make the server's view of us match reality. */
  private reconcile(self: Participant): void {
    const local = useMedia.getState();
    const sharing = local.screen.status === 'sharing' || local.screen.status === 'paused';
    if (sharing && self.screen === 'none') {
      void signaling.request('screen:start').catch(() => this.stopScreen({ notifyServer: false }));
    } else if (!sharing && self.screen !== 'none') {
      signaling.socket.emit('screen:stop');
    }
    const muted = local.mic.muted || local.mic.status !== 'ready';
    if (self.micMuted !== muted) signaling.socket.emit('audio:state', { micMuted: muted });
  }

  private createPeerManager(selfId: string, iceServers: RTCIceServer[]): PeerManager {
    return new PeerManager(selfId, iceServers, {
      send: (to, gen, signal) => {
        if (signal.kind === 'description') {
          const event = signal.description.type === 'offer' ? 'webrtc:offer' : 'webrtc:answer';
          signaling.socket.emit(event, { to, gen, description: signal.description });
        } else {
          signaling.socket.emit('webrtc:ice-candidate', { to, gen, candidate: signal.candidate });
        }
      },
      onAudio: (peerId, stream) => {
        useMedia.getState().setRemote(peerId, { audio: stream });
        this.speaking.track(peerId, stream);
      },
      onScreen: (peerId, stream) => useMedia.getState().setRemote(peerId, { screen: stream }),
      onState: (peerId, state) => useMedia.getState().setPeerState(peerId, state),
    });
  }

  private dropPeer(id: string): void {
    this.peers?.remove(id);
    this.speaking.untrack(id);
    useMedia.getState().forgetPeer(id);
  }

  // ── Signaling events ───────────────────────────────────────────────────────

  private bindSignaling(): void {
    const s = signaling.socket;
    const on = <A extends unknown[]>(event: string, handler: (...args: A) => void) => {
      (s.on as (e: string, h: (...args: A) => void) => void)(event, handler);
      this.offs.push(() => (s.off as (e: string, h: (...args: A) => void) => void)(event, handler));
    };
    const nameOf = (id: string) => useRoom.getState().participants[id]?.name ?? 'Alguém';
    const isSelf = (id: string) => id === useRoom.getState().selfId;

    on('participant:joined', (p: Participant) => {
      useRoom.getState().upsertParticipant(p);
      this.peers?.connect(p.id);
      notify.info(`${p.name} entrou na sala`);
    });

    on('participant:left', ({ id, reason }: { id: string; reason: string }) => {
      if (isSelf(id)) return; // handled by room:ended (kicked)
      const name = nameOf(id);
      useRoom.getState().removeParticipant(id);
      this.dropPeer(id);
      if (reason === 'timeout') notify.info(`${name} perdeu a conexão`);
      else if (reason === 'kicked') notify.info(`${name} foi removido da sala`);
      else notify.info(`${name} saiu da sala`);
    });

    on('participant:updated', (p: Participant) => {
      const before = useRoom.getState().participants[p.id];
      useRoom.getState().upsertParticipant(p);
      if (isSelf(p.id) && before && before.role !== 'host' && p.role === 'host') {
        notify.info('Você agora é o host da sala');
      }
    });

    on('screen:start', ({ participantId }: { participantId: string }) => {
      useRoom.getState().setSharer(participantId);
      useUi.getState().resetView();
      if (!isSelf(participantId)) notify.info(`${nameOf(participantId)} começou a compartilhar`);
    });

    on('screen:stop', ({ participantId }: { participantId: string }) => {
      if (useRoom.getState().sharerId === participantId) useRoom.getState().setSharer(null);
      if (!isSelf(participantId)) notify.info('Compartilhamento encerrado');
    });

    on('room:ended', ({ reason }: { reason: RoomEndReason }) => this.handleEnded(reason));

    on(
      'webrtc:offer',
      (m: { from: string; gen: number; description: never }) =>
        void this.peers?.handleDescription(m.from, m.gen, m.description),
    );
    on(
      'webrtc:answer',
      (m: { from: string; gen: number; description: never }) =>
        void this.peers?.handleDescription(m.from, m.gen, m.description),
    );
    on(
      'webrtc:ice-candidate',
      (m: { from: string; gen: number; candidate: never }) =>
        void this.peers?.handleCandidate(m.from, m.gen, m.candidate),
    );

    on('disconnect', (reason: string) => {
      if (reason === 'io client disconnect' || this.disposed) return;
      const status = useRoom.getState().status;
      if (status === 'joined' || status === 'joining') {
        useRoom.getState().setStatus('reconnecting');
        this.armReconnectWindow();
      }
    });

    on('connect', () => {
      const status = useRoom.getState().status;
      if (status === 'reconnecting' || status === 'disconnected') void this.requestJoin(true);
    });

    const onOnline = () => {
      if (useRoom.getState().status === 'disconnected') this.retry();
    };
    window.addEventListener('online', onOnline);
    this.offs.push(() => window.removeEventListener('online', onOnline));
  }

  private bindMicrophone(): void {
    this.offs.push(
      microphone.onTrackChange((track, stream) => {
        void this.peers?.setAudioTrack(track, stream);
        if (signaling.connected)
          signaling.socket.emit('audio:state', {
            micMuted: !track || useMedia.getState().mic.muted,
          });
        const selfId = useRoom.getState().selfId;
        if (selfId) this.speaking.track(selfId, stream);
      }),
    );
  }

  private handleEnded(reason: RoomEndReason): void {
    this.stopScreen({ silent: true, notifyServer: false });
    roomSecrets.clearResumeToken(this.code);
    this.dispose();
    microphone.release();
    useRoom.getState().end(reason);
  }

  private armReconnectWindow(): void {
    this.clearReconnectWindow();
    this.reconnectTimer = window.setTimeout(() => {
      if (useRoom.getState().status === 'reconnecting')
        useRoom.getState().setStatus('disconnected');
    }, RECONNECT_WINDOW_MS);
  }

  private clearReconnectWindow(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private onStats(
    stats: Parameters<ReturnType<typeof useMedia.getState>['setStats']>[0],
    quality: LinkQuality,
  ): void {
    useMedia.getState().setStats(stats, quality);
    // Report only stable changes (two consecutive samples) to avoid chatter.
    if (quality === this.pendingQuality && quality !== this.reportedQuality) {
      this.reportedQuality = quality;
      if (signaling.connected) signaling.socket.emit('connection:state', { quality });
    }
    this.pendingQuality = quality;
  }

  // ── Microphone ─────────────────────────────────────────────────────────────

  async toggleMic(): Promise<void> {
    const { mic } = useMedia.getState();
    if (mic.status !== 'ready') {
      await microphone.acquire(useSettings.getState().micDeviceId);
      if (useMedia.getState().mic.status !== 'ready') {
        const kind =
          useMedia.getState().mic.status === 'denied' ? 'mic-blocked' : 'mic-unavailable';
        notify.error(ERROR_COPY[kind].title, ERROR_COPY[kind].description);
        return;
      }
      this.setMuted(false);
      return;
    }
    this.setMuted(!mic.muted);
  }

  private setMuted(muted: boolean): void {
    microphone.setMuted(muted);
    if (signaling.connected) signaling.socket.emit('audio:state', { micMuted: muted });
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    useSettings.getState().set({ micDeviceId: deviceId });
    await microphone.acquire(deviceId);
    if (useMedia.getState().mic.status === 'ready') notify.success('Microfone alterado');
  }

  // ── Screen share ───────────────────────────────────────────────────────────

  async startScreen(): Promise<void> {
    const media = useMedia.getState();
    const room = useRoom.getState();
    if (
      media.screen.status === 'requesting' ||
      media.screen.status === 'sharing' ||
      media.screen.status === 'paused'
    ) {
      return;
    }
    if (room.sharerId && room.sharerId !== room.selfId) {
      const name = room.participants[room.sharerId]?.name ?? 'Alguém';
      notify.warning(
        `${name} já está compartilhando`,
        'Apenas uma tela pode ser transmitida por vez.',
      );
      return;
    }
    if (this.endedTimer !== null) window.clearTimeout(this.endedTimer);

    media.setScreen({ status: 'requesting', error: null });
    const settings = screenSettings();
    const result = await captureScreen(settings);
    if (this.disposed) {
      if (result.ok) result.stream.getTracks().forEach((t) => t.stop());
      return;
    }
    if (!result.ok) {
      if (result.reason === 'cancelled') media.setScreen({ status: 'idle' });
      else media.setScreen({ status: 'error', error: result.error });
      return;
    }

    try {
      await signaling.request('screen:start');
    } catch (err) {
      result.stream.getTracks().forEach((t) => t.stop());
      useMedia.getState().setScreen({ status: 'idle' });
      if (err instanceof SignalingError && err.code === 'SCREEN_BUSY') {
        notify.warning(
          'Outra pessoa começou a compartilhar',
          'Apenas uma tela pode ser transmitida por vez.',
        );
      } else {
        notify.error(
          'Não foi possível iniciar o compartilhamento',
          'Verifique sua conexão e tente novamente.',
        );
      }
      return;
    }

    if (this.disposed || result.track.readyState === 'ended') {
      result.stream.getTracks().forEach((t) => t.stop());
      if (signaling.connected) signaling.socket.emit('screen:stop');
      return;
    }

    this.screen = { stream: result.stream, track: result.track };
    // The browser's own "Stop sharing" button ends the track — reflect it immediately.
    result.track.addEventListener('ended', () => {
      if (this.screen?.track === result.track) this.stopScreen({ notifyServer: true });
    });
    useMedia
      .getState()
      .setScreen({ status: 'sharing', stream: result.stream, surface: result.surface });
    useRoom.getState().setSharer(useRoom.getState().selfId);
    await this.peers?.setScreen({
      track: result.track,
      encoding: (viewers) => encodingFor(settings, viewers),
      degradation: degradationFor(settings.optimization),
    });
    notify.success('Compartilhamento iniciado');
  }

  stopScreen(opts: { silent?: boolean; notifyServer?: boolean } = {}): void {
    const current = this.screen;
    if (!current) {
      const status = useMedia.getState().screen.status;
      if (status === 'error') useMedia.getState().setScreen({ status: 'idle', error: null });
      return;
    }
    this.screen = null;
    current.stream.getTracks().forEach((t) => t.stop());
    void this.peers?.setScreen(null);
    if (opts.notifyServer !== false && signaling.connected) signaling.socket.emit('screen:stop');
    const room = useRoom.getState();
    if (room.sharerId === room.selfId) room.setSharer(null);

    useMedia.getState().setScreen({ status: 'ended', stream: null, surface: null });
    this.endedTimer = window.setTimeout(() => {
      if (useMedia.getState().screen.status === 'ended')
        useMedia.getState().setScreen({ status: 'idle' });
    }, 1400);
    if (!opts.silent) notify.info('Compartilhamento encerrado');
  }

  togglePause(): void {
    if (!this.screen) return;
    const paused = useMedia.getState().screen.status !== 'paused';
    this.screen.track.enabled = !paused;
    useMedia.getState().setScreen({ status: paused ? 'paused' : 'sharing' });
    signaling.socket.emit('screen:pause', { paused });
  }

  /** Quality / FPS / optimization changed in settings — apply live without restarting. */
  async applyScreenSettings(): Promise<void> {
    if (!this.screen) return;
    const settings = screenSettings();
    await applyCaptureSettings(this.screen.track, settings);
    this.peers?.updateScreenEncodings({
      encoding: (viewers) => encodingFor(settings, viewers),
      degradation: degradationFor(settings.optimization),
    });
  }

  /** Viewer-side: rebuild the link to the sharer if the stream never arrives. */
  reconnectPeer(peerId: string): void {
    this.peers?.rebuild(peerId);
  }

  rename(name: string): void {
    this.name = name;
  }
}

// ── Singleton access ─────────────────────────────────────────────────────────

let current: RoomSession | null = null;

export function getSession(): RoomSession | null {
  return current && current.active ? current : null;
}

export function startSession(code: string, name: string): RoomSession {
  if (current?.active && current.code === code) return current;
  current?.dispose();
  current = new RoomSession(code, name);
  void current.join();
  return current;
}
