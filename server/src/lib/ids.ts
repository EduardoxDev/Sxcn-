import { randomBytes } from 'node:crypto';

/** URL-safe random identifier. 16 bytes → 22 chars. */
export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}
