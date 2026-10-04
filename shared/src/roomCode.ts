import { ROOM_CODE_ALPHABET, ROOM_CODE_GROUP, ROOM_CODE_LENGTH } from './constants';

const ALPHABET_SET = new Set(ROOM_CODE_ALPHABET);
const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_GROUP}}-[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_GROUP}}$`,
);

/** Generates an unbiased room code such as `HG3V-WPST` using a CSPRNG. */
export function generateRoomCode(): string {
  const n = ROOM_CODE_ALPHABET.length;
  // Rejection sampling keeps the distribution uniform: discard bytes >= the largest multiple of n.
  const limit = 256 - (256 % n);
  const chars: string[] = [];
  const buffer = new Uint8Array(ROOM_CODE_LENGTH * 2);
  while (chars.length < ROOM_CODE_LENGTH) {
    globalThis.crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte < limit && chars.length < ROOM_CODE_LENGTH) {
        chars.push(ROOM_CODE_ALPHABET[byte % n]!);
      }
    }
  }
  return `${chars.slice(0, ROOM_CODE_GROUP).join('')}-${chars.slice(ROOM_CODE_GROUP).join('')}`;
}

export function isValidRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

/**
 * Accepts anything a user might paste — `hg3v wpst`, `HG3VWPST`, or a full invite link
 * (`https://host/room/HG3V-WPST`) — and returns the canonical code, or `null`.
 */
export function normalizeRoomCode(input: string): string | null {
  if (typeof input !== 'string') return null;
  let raw = input.trim().slice(0, 512);
  const fromLink = /\/room\/([A-Za-z0-9-]+)/.exec(raw);
  if (fromLink?.[1]) raw = fromLink[1];
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of compact) if (!ALPHABET_SET.has(ch)) return null;
  return `${compact.slice(0, ROOM_CODE_GROUP)}-${compact.slice(ROOM_CODE_GROUP)}`;
}
