/**
 * Official logo slot.
 *
 * Drop the official files into `src/assets/brand/` and they are picked up automatically —
 * no component changes required:
 *   - `scxn-mark.svg|png|webp`  → symbol only (the two eyes). Transparent SVG preferred.
 *   - `scxn-logo.svg|png|webp`  → full lockup (symbol + wordmark).
 * If a file has its own black background that is fine: every surface it sits on is near-black.
 * Until then, `<ScxnMark />` renders a built-in vector placeholder.
 */
const marks = import.meta.glob<string>('../../assets/brand/scxn-mark.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const logos = import.meta.glob<string>('../../assets/brand/scxn-logo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const customMarkSrc: string | null = Object.values(marks)[0] ?? null;
export const customLogoSrc: string | null = Object.values(logos)[0] ?? null;
