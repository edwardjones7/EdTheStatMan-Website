# Changelog

Notable changes to EdTheStatMan.com. Numbering rules and how to cut a release
are in [`docs/RELEASING.md`](docs/RELEASING.md).

This file starts at 3.0.0. Everything before it shipped untagged; see `git log`.

## [3.0.0] — 2026-09-06

The ladder. Four flat tiers became five rungs sold as three named products, the
site was rebuilt around them, and the URL structure moved to match.

65 commits and 10 migrations, all applied to production.

### Added

- **The five-rung ladder.** Public (free), The Portfolio, The Research Desk,
  Vault Private Intelligence, Vault Institutional Intelligence. Each rung is
  sold on two billing periods: a monthly SKU and a season pass that runs through
  the Super Bowl. The Portfolio never recurs on either; Research Desk and above
  recur monthly. Defined once in `lib/offer.ts` and read from there by the
  pricing cards, the checkout route and the Stripe webhook.
- **The Research Desk** (`/desk/[sport]`) — the season on one board, week by
  week, with the schedule, scores and the posted market for each game, and a
  page per matchup at `/desk/[sport]/g/[slug]`. Live for NFL and college
  football; 428 published 2026 games at time of release.
- **College football**, end to end: its own board, its own logos, school names
  resolved from ESPN's display names, and its own Vault library.
- **Open and close lines.** The ESPN sync captures the spread, total and both
  moneylines at open and current, and the game pages show the move. Prices are
  refused rather than overwritten once a game kicks off, because the last number
  before kickoff *is* the closing line and every ATS result is computed from it.
- **The Vault** (`/vault/systems`, `/vault/trends`) with a typed key on every
  row — `NFLS0006`, `CFBT0010` — unique, sortable and searchable, so a row can
  be named in a message and found again.
- **Pick notifications** on insert, to Discord, email and web push, fired on the
  ladder so each rung gets what it pays for.
- **Discord entitlement sync.** Linking an account grants the Members role from
  site entitlement; a nightly cron reconciles it, which is the half that matters
  because a lapsed season pass fires no Stripe event.
- **Admin channels** for new accounts and for money, each with its own webhook
  and its own role ping, no fallback between them.
- **The graded record on the Portfolio**, computed from the bets table rather
  than typed, broken down per sport.

### Changed

- **Routes moved to the v3 IA**, each with a permanent redirect and no dropped
  URL: `/pricing` → `/win`, `/betting-systems` → `/vault/systems`,
  `/betting-trends` → `/vault/trends`, `/model-picks` → `/portfolio`,
  `/results` → `/portfolio/performance`, `/nfl` → `/desk/nfl`,
  `/nfl/games/:slug` → `/desk/nfl/g/:slug`.
- **Every rung is called by its ladder name** everywhere a reader can see one.
  The free rung is "Public" in full and "Free" in short; Basic, Premium and
  Elite are gone from the interface.
- **Billing runs on two slots**, a pass and a subscription, with the highest
  active grant winning. The old rank comparison in the webhook was deleted
  rather than ported.
- **Offer copy was cut back to what the product delivers today.** Bullets for
  unit sizing, curated Desk trends, the weekly note and the four Institutional
  tools were removed because none of them were true on the day.
- The Private/Institutional split is sold as a significance bar. The thresholds
  and the null they are measured against stay internal.

### Fixed

- **Every subscription payment was missing from the revenue ledger.** A partial
  unique index cannot serve `ON CONFLICT` through PostgREST (42P10), so each
  upsert failed silently.
- **A stale `stripe_customer_id` 500'd checkout forever** instead of recovering.
- **A 30-day member could not buy the season pass** they already qualified for.
- **The Research Desk showed the wrong season.** The history backfill put 2024
  and 2025 rows in the same table, and an unscoped read took its season from the
  first row by kickoff.
- **The admin link picker offered no systems at all**, for every sport: the
  query selected a column `betting_systems` does not have, PostgREST failed the
  whole request, and the null result rendered as an empty list. Also scoped to
  one sport per picker, ordered by Vault code, and given ID search.
- **The reveal animation left content invisible** after a client navigation —
  a one-shot observer only ever saw the page being left.
- Mobile: three layout faults on the Vault pages, and an iOS ticker that
  ignored the font size until `-webkit-text-size-adjust` was inlined.

### Infrastructure

- Ten migrations: `tier_ladder_01`–`07`, `vault_01`–`02`, `discord_01`.
- Scripts to stand up v3 billing in Stripe, refusing `--live` when the key is a
  test key.
- An end-to-end payment rehearsal runbook (`docs/TESTING-PAYMENTS.md`).
- Versioning: `package.json` now tracks the release, and the admin dashboard
  prints the version it was built from.

### Not in this release

- **EdTheStatBot** is parked on its own branch. The ladder shipped without him,
  and the homepage teaser was removed.
- **Curated research on the Desk.** The board, the schedule and the market are
  live; the per-game writeups and the curated system and trend links are not
  written yet. The tooling for them ships here, the content does not.
