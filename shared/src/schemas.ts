import { z } from 'zod';
import { MAX_CANDIDATE_LENGTH, MAX_SDP_LENGTH } from './constants';
import { isValidRoomCode } from './roomCode';
import { sanitizeName } from './sanitize';

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const token = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const roomCodeSchema = z.string().refine(isValidRoomCode, 'Invalid room code');

export const nameSchema = z
  .string()
  .max(256)
  .transform(sanitizeName)
  .refine((v) => v.length > 0, 'Name is required');

export const emptySchema = z.object({}).strict();
export const roomPeekSchema = z.object({ code: roomCodeSchema });

export const roomJoinSchema = z.object({
  code: roomCodeSchema,
  name: nameSchema,
  micMuted: z.boolean(),
  resumeToken: token.optional(),
  hostKey: token.optional(),
});

export const sessionDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer']),
  sdp: z.string().max(MAX_SDP_LENGTH),
});

export const iceCandidateSchema = z
  .object({
    candidate: z.string().max(MAX_CANDIDATE_LENGTH),
    sdpMid: z.string().max(64).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
    usernameFragment: z.string().max(256).nullable().optional(),
  })
  .nullable();

/** `gen` identifies the sender's RTCPeerConnection instance (monotonic per client). */
export const descriptionRelaySchema = z.object({
  to: id,
  gen: z.number().int().nonnegative(),
  description: sessionDescriptionSchema,
});

export const candidateRelaySchema = z.object({
  to: id,
  gen: z.number().int().nonnegative(),
  candidate: iceCandidateSchema,
});

export const audioStateSchema = z.object({ micMuted: z.boolean() });
export const screenPauseSchema = z.object({ paused: z.boolean() });
export const connectionStateSchema = z.object({
  quality: z.enum(['unknown', 'good', 'fair', 'poor']),
});
export const kickSchema = z.object({ participantId: id });

export type RoomJoinPayload = z.input<typeof roomJoinSchema>;
export type SessionDescriptionPayload = z.infer<typeof sessionDescriptionSchema>;
export type IceCandidatePayload = z.infer<typeof iceCandidateSchema>;
