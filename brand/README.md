# Brand assets (cursor E mark)

- `mark.svg` bare mark (viewBox 24 28 52 44); `mark-tile.svg` mark on the rounded #18212A tile. Same paths as `components/BrandMark.tsx`; change them together.
- `x-avatar.svg/.png` X profile picture (400x400); `x-banner.svg/.png` X header (1500x500, bottom-left kept clear for the avatar).
- `fonts/` official Archivo + JetBrains Mono variable TTFs (google/fonts) with their OFL.txt, plus static instances cut by `fonts/instance.py` (fontTools), because resvg cannot select variable-font axes. `x-banner.svg` names those instances, so view it via the PNG.
- `export.mjs` writes every PNG plus the site icons: `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`, `public/logo.png`, `public/icon-192.png`, `public/badge-96.png`.
- Re-export: `npm run brand:export` (= `node brand/export.mjs`).
- The X files are uploaded by hand on x.com; nothing deploys them.
