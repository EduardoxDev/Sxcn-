import type {
  Ack,
  IceServer,
  LeaveReason,
  LinkQuality,
  Participant,
  RoomEndReason,
  RoomSnapshot,
} from './types';
import type { IceCandidatePayload, RoomJoinPayload, SessionDescriptionPayload } from './schemas';

export interface RoomPeekResult {
  exists: boolean;
  ended: boolean;
  full: boolean;
  participantCount: number;
  maxParticipants: number;
}

export interface CreateRoomResult {
  code: string;
  /** Secret proving room ownership; whoever joins with it becomes host. */
  hostKey: string;
}

export interface JoinResult {
  self: Participant;
  room: RoomSnapshot;
  resumeToken: string;
  resumed: boolean;
  iceServers: IceServer[];
}

export interface DescriptionRelay {
  to: string;
  gen: number;
  description: SessionDescriptionPayload;
}

export interface CandidateRelay {
  to: string;
  gen: number;
  candidate: IceCandidatePayload;
}

export interface DescriptionMessage {
  from: string;
  gen: number;
  description: SessionDescriptionPayload;
}

export interface CandidateMessage {
  from: string;
  gen: number;
  candidate: IceCandidatePayload;
}

type Reply<T> = (res: Ack<T>) => void;

/** Events the browser sends to the signaling server. */
export interface ClientToServerEvents {
  'room:create': (payload: Record<string, never>, ack: Reply<CreateRoomResult>) => void;
  'room:peek': (payload: { code: string }, ack: Reply<RoomPeekResult>) => void;
  'room:join': (payload: RoomJoinPayload, ack: Reply<JoinResult>) => void;
  'room:leave': (ack: Reply<null>) => void;
  'room:end': (ack: Reply<null>) => void;
  'room:kick': (payload: { participantId: string }, ack: Reply<null>) => void;

  'webrtc:offer': (payload: DescriptionRelay) => void;
  'webrtc:answer': (payload: DescriptionRelay) => void;
  'webrtc:ice-candidate': (payload: CandidateRelay) => void;

  'screen:start': (ack: Reply<null>) => void;
  'screen:stop': () => void;
  'screen:pause': (payload: { paused: boolean }) => void;

  'audio:state': (payload: { micMuted: boolean }) => void;
  'connection:state': (payload: { quality: LinkQuality }) => void;
}

/** Events the signaling server pushes to browsers. */
export interface ServerToClientEvents {
  'participant:joined': (participant: Participant) => void;
  'participant:left': (payload: { id: string; reason: LeaveReason }) => void;
  'participant:updated': (participant: Participant) => void;

  'screen:start': (payload: { participantId: string }) => void;
  'screen:stop': (payload: { participantId: string }) => void;

  'room:ended': (payload: { reason: RoomEndReason }) => void;

  'webrtc:offer': (message: DescriptionMessage) => void;
  'webrtc:answer': (message: DescriptionMessage) => void;
  'webrtc:ice-candidate': (message: CandidateMessage) => void;
}
