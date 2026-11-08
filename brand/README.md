# Brand assets (Clean E mark)

- `mark.svg` bare mark for light grounds (viewBox 24 16 58 68, blue #1F6FEB to sky #0EA5E9); `mark-on-navy.svg` the same for navy (#4C9BFF to #38BDF8); `mark-tile.svg` the mark on the rounded #0B1F3A tile. Same path as `components/BrandMark.tsx`; change them together.
- `x-avatar.svg/.png` X profile picture (400x400); `x-banner.svg/.png` X header (1500x500, bottom-left kept clear for the avatar).
- `fonts/` official Archivo + JetBrains Mono variable TTFs (google/fonts) with their OFL.txt, plus static instances cut by `fonts/instance.py` (fontTools), because resvg cannot select variable-font axes. `x-banner.svg` names those instances, so view it via the PNG.
- `export.mjs` writes every PNG plus the site icons: `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`, `public/logo.png`, `public/icon-192.png`, `public/badge-96.png`.
- Re-export: `npm run brand:export` (= `node brand/export.mjs`).
- The X files are uploaded by hand on x.com; nothing deploys them.
- `og-cover.svg` the link-preview card (1200x630). The export writes `brand/og-cover.png`; convert it to `public/og-cover.jpg` with `sips -s format jpeg brand/og-cover.png --out public/og-cover.jpg` (pages reference the .jpg). Keep figures off it: a record baked into an image goes stale.
