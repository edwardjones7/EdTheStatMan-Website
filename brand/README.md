# Brand assets (Clean E mark)

- `mark.svg` bare mark for light grounds (viewBox 24 16 58 68, blue #1F6FEB to sky #0EA5E9); `mark-on-navy.svg` the same for navy (#4C9BFF to #38BDF8); `mark-tile.svg` the mark on the rounded #0B1F3A tile. Same path as `components/BrandMark.tsx`; change them together.
- `x-avatar.svg/.png` X profile picture (exported 800x800; X crops it to a circle) and `x-banner.svg/.png` X header (1500x500), redrawn Nov 2026 for the front-page redesign: near-black navy, Barlow, the Clean E blue. The banner keeps the bottom-left (about x 0-430, y 330-500) clear for the avatar and its text inside y 90-420 for phone cropping, and carries no figures.
- `fonts/Barlow*.ttf` the redesign's type, official static files from google/fonts (OFL in `Barlow-OFL.txt`).
- `fonts/` official Archivo + JetBrains Mono variable TTFs (google/fonts) with their OFL.txt, plus static instances cut by `fonts/instance.py` (fontTools), because resvg cannot select variable-font axes. `x-banner.svg` names those instances, so view it via the PNG.
- `export.mjs` writes every PNG plus the site icons: `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`, `public/logo.png`, `public/icon-192.png`, `public/badge-96.png`.
- Re-export: `npm run brand:export` (= `node brand/export.mjs`).
- The X files are uploaded by hand on x.com; nothing deploys them.
- `og-cover.svg` the link-preview card (1200x630), redrawn Nov 2026 to match the X header `drafts/g-hoop-max`: mark and name top-left, the three-line headline, leagues and URL, the mirrored hoop with a "Graded · Win" callout on the ball. `href="photo:nba"` is inlined by export.mjs from `public/images/sports/nba.jpg`. The export writes `brand/og-cover.png`; pages serve `public/og-cover.jpg`, so convert it (macOS: `sips -s format jpeg brand/og-cover.png --out public/og-cover.jpg`; Windows: System.Drawing at JPEG quality 88, about 125 KB). Keep figures off it: a record baked into an image goes stale.
