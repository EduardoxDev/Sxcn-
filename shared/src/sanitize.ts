import { NAME_MAX_LENGTH } from './constants';

// Control chars, zero-width chars, bidi overrides and other invisible formatting.
const INVISIBLE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

/**
 * Normalizes a display name: NFKC, strips invisible/control characters and markup brackets,
 * collapses whitespace, and truncates by code point. Returns '' when nothing usable remains.
 */
export function sanitizeName(input: unknown): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .slice(0, 256)
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, NAME_MAX_LENGTH).join('').trim();
}

/** One or two letters for avatars. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0]!)[0] ?? '?';
  if (parts.length === 1) return first.toUpperCase();
  const last = Array.from(parts[parts.length - 1]!)[0] ?? '';
  return (first + last).toUpperCase();
}
