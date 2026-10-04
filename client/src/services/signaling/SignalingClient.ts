import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@scxn/shared';
import { SignalingError } from '@/lib/errors';

type ScxnSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type TransportState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** Request/ack events: last argument is the ack callback. */
type AckEvents = {
  [K in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[K]> extends [
    ...infer _A,
    (res: Ack<infer _T>) => void,
  ]
    ? K
    : never;
}[keyof ClientToServerEvents];

type AckData<K extends AckEvents> =
  Parameters<ClientToServerEvents[K]> extends [...infer _A, (res: Ack<infer T>) => void]
    ? T
    : never;

type AckArgs<K extends AckEvents> =
  Parameters<ClientToServerEvents[K]> extends [...infer A, (res: Ack<infer _T>) => void]
    ? A
    : never;

const CONNECT_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Thin, typed wrapper around Socket.IO. Owns the transport and exposes promise-based requests.
 * Room semantics live in RoomSession — this class knows nothing about the UI.
 */
export class SignalingClient {
  readonly socket: ScxnSocket;
  private stateListeners = new Set<(s: TransportState) => void>();
  private _state: TransportState = 'idle';

  constructor(url: string | undefined) {
    const options = {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 600,
      reconnectionDelayMax: 4000,
      randomizationFactor: 0.4,
      timeout: CONNECT_TIMEOUT_MS,
    };
    this.socket = (url ? io(url, options) : io(options)) as ScxnSocket;

    this.socket.on('connect', () => this.setState('connected'));
    this.socket.on('disconnect', (reason) => {
      // "io client disconnect" = we closed it on purpose.
      this.setState(reason === 'io client disconnect' ? 'idle' : 'reconnecting');
    });
    this.socket.io.on('reconnect_attempt', () => this.setState('reconnecting'));
    this.socket.on('connect_error', () => {
      if (this._state === 'connecting') this.setState('offline');
    });
  }

  get state(): TransportState {
    return this._state;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  onState(listener: (s: TransportState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: TransportState): void {
    if (state === this._state) return;
    this._state = state;
    for (const l of this.stateListeners) l(state);
  }

  /** Resolves once connected; rejects after a bounded wait — never hangs. */
  connect(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        this.setState('offline');
        reject(new SignalingError('TIMEOUT', 'Signaling connection timed out'));
      }, CONNECT_TIMEOUT_MS);
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        this.socket.off('connect', onConnect);
      };
      this.socket.on('connect', onConnect);
      if (!this.socket.active) {
        this.setState('connecting');
        this.socket.connect();
      }
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  /** Emits an ack-style event and resolves with `data`, or throws a SignalingError. */
  async request<K extends AckEvents>(event: K, ...payload: AckArgs<K>): Promise<AckData<K>> {
    await this.connect();
    let res: Ack<AckData<K>>;
    try {
      const emitter = this.socket.timeout(REQUEST_TIMEOUT_MS) as unknown as {
        emitWithAck: (event: string, ...args: unknown[]) => Promise<Ack<AckData<K>>>;
      };
      res = await emitter.emitWithAck(event, ...payload);
    } catch {
      throw new SignalingError(
        this.socket.connected ? 'TIMEOUT' : 'DISCONNECTED',
        `${event} timed out`,
      );
    }
    if (!res.ok) throw new SignalingError(res.error.code, res.error.message);
    return res.data;
  }
}

export const signaling = new SignalingClient(import.meta.env.VITE_SIGNALING_URL || undefined);
