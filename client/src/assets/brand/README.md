# Brand assets

Place the official Scxn files here. They are detected automatically by
`src/components/brand/logoAsset.ts` — no component changes needed.

| File                          | Used for                        |
| ----------------------------- | ------------------------------- |
| `scxn-mark.svg` (or png/webp) | Symbol only (the two eyes)      |
| `scxn-logo.svg` (or png/webp) | Full lockup (symbol + wordmark) |

Also replace `client/public/favicon.svg` with the official app icon.

A transparent SVG is preferred. Files with an embedded black background also work,
because every surface the logo sits on is near-black.
