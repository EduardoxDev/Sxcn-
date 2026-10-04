export type ParticipantRole = 'host' | 'participant';
export type Presence = 'online' | 'reconnecting';
export type ScreenState = 'none' | 'sharing' | 'paused';
export type LinkQuality = 'unknown' | 'good' | 'fair' | 'poor';

/** Public participant shape broadcast to everybody in the room. */
export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  micMuted: boolean;
  screen: ScreenState;
  presence: Presence;
  quality: LinkQuality;
  joinedAt: number;
}

export interface RoomSnapshot {
  code: string;
  createdAt: number;
  maxParticipants: number;
  sharerId: string | null;
  participants: Participant[];
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_ENDED'
  | 'ROOM_FULL'
  | 'ROOM_LIMIT'
  | 'INVALID_PAYLOAD'
  | 'INVALID_NAME'
  | 'RATE_LIMITED'
  | 'NOT_IN_ROOM'
  | 'ALREADY_IN_ROOM'
  | 'SCREEN_BUSY'
  | 'FORBIDDEN'
  | 'INTERNAL';

export interface ServerError {
  code: ErrorCode;
  message: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ServerError };

export type RoomEndReason = 'ended-by-host' | 'kicked' | 'expired';
export type LeaveReason = 'left' | 'timeout' | 'kicked';
