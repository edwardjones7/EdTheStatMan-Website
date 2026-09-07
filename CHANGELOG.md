# Changelog

Notable changes to EdTheStatMan.com. Numbering rules and how to cut a release
are in [`docs/RELEASING.md`](docs/RELEASING.md).

This file starts at 3.0.0. Everything before it shipped untagged; see `git log`.

## [3.7.1] — 2026-09-07

### Fixed

- Curated systems and trends on a game page were badged **NFL** regardless of
  their actual sport — a leftover from when the Desk was NFL-only. A college
  trend read `NFL` with a code of `RUTGT00002` beside it. Both the visible row
  and the locked teaser now use the row's own sport.

## [3.7.0] — 2026-09-07

### Changed

- **Pick emails now reach every account, not just entitled members.** Anyone who
  cannot open the pick gets a different message — it names the rung the pick sits
  behind and links to the board, rather than telling them to log in and view
  something they will not find. Safe because no email has ever carried the pick
  itself. Entitled members are sent first, so a provider quota runs out on the
  announcement and never on a paid alert. `NOTIFY_ANNOUNCE_ALL=false` restores
  the old behaviour. Push and Discord are unchanged.

## [3.6.0] — 2026-09-07

### Added

- **Research can be closed on a game once it has been played.** A checkbox on
  each game shuts the Research Desk rung's in-context view of that game's
  curated systems and trends, so a season of played games stops adding up to the
  Private library. Private, Institutional and admins are unaffected; a Desk
  member on a closed game sees the same record-only teasers a free reader does.
  Requires `supabase/migrations/desk_01_research_closed.sql`; until it is
  applied every game reads as open and the field is skipped on save.

## [3.5.0] — 2026-09-07

### Added

- **The Research Desk remembers where you were.** Leaving the board and coming
  back returns you to the sport and week you were on, rather than the NFL's
  first unplayed week. Remembered per sport, so college Week 3 and NFL Week 1
  coexist; `/desk` opens whichever board you were last on. An explicit `?week=`
  still wins, so shared links mean what they say, and the memory ages out after
  seven days.

## [3.4.0] — 2026-09-07

### Added

- **The Research Desk keeps itself current.** The board syncs the week it is
  showing when you arrive, and again every 60 seconds while a game is live or
  about to kick off, then re-renders — so it lands on the current week with real
  scores and leads each day with what is in progress, without anyone pressing
  Sync. A daily cron (`/api/cron/desk-sync`) covers this week and next for both
  sports when nobody is on the page.
- `lib/desk-sync.ts`: one sync implementation, shared by the admin button, the
  board and the cron.

### Fixed

- A sync rewrote every row it read even when nothing had changed, because
  `kickoff` compared unequal on every game — the parser writes `.000Z` and
  PostgREST returns `+00:00` for the same instant. A college week went from 99
  writes and 12.9s to 0 writes and 4.2s.

## [3.3.0] — 2026-09-07

### Changed

- **The Portfolio is the picks; `/portfolio/performance` is the results.** The
  graded record, the per-sport split and the full results table came off the
  picks page — they were there because reaching the results page used to take
  two navigations, which the nav menus fixed. The per-sport breakdown moved to
  the results page rather than being dropped.

### Fixed

- `/portfolio` rendered its title twice: "The Portfolio — EdTheStatMan.com –
  EdTheStatMan.com". The layout appends the site name through a title template,
  so a page must not carry it as well.

## [3.2.0] — 2026-09-07

### Added

- **Dropdown menus on the three multi-page products.** The Portfolio (Picks,
  Results), Research Desk (NFL, College Football) and The Vault (Systems,
  Trends). The parent stays a link to its own default page; the menu removes the
  first of the two page loads it used to take to reach the second page. On
  mobile the children are listed inline under their parent rather than behind an
  accordion.

### Fixed

- Nav active state used a prefix match everywhere, so on `/portfolio/performance`
  both Picks and Results read as the current page.

## [3.1.0] — 2026-09-06

### Added

- **Comp, extend and revoke access from the admin dashboard.** `PATCH
  /api/admin/users/[id]` writes the pass slot and lets `recompute_entitlement()`
  reconcile, so a comp can sit on top of a paid subscription without either one
  clobbering the other. There was previously no users route at all — granting
  access meant a hand-written UPDATE against production.
- An **Access** column on the users table: the expiry date, and whether the
  entitlement comes from a pass, a subscription, or both. A **Lapsed** filter
  and a lapsed count alongside the free/paid split.

### Fixed

- **The dashboard counted lapsed members as paying customers.** It read
  `subscription_tier`, which is derived and only recomputed by a webhook —
  and expiry fires no webhook. Two members who lapsed in May and August read as
  Private and Research Desk with no expiry shown. Every row now resolves the way
  `resolveAccess()` does.
- Admins were counted as Institutional *and* as Admins, inflating paid members
  by two. The breakdown sums to the total again.

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
