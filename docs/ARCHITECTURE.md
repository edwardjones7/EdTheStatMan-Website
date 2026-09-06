# EdTheStatMan Architecture

The single technical reference for this codebase. If something here disagrees with `README.md`, this file wins.

**Accurate as of 2026-08-31, 22:06 ET**, against a working tree that was being actively edited while this was written. The v3 tier ladder described in §7 is **staged and undeployed** — committed to neither git nor the production database. Re-check `git status` before trusting any "current state" claim below.

---

## 1. What this is

A sports-betting membership site. The product is a predictive model built over years out of thousands of spreadsheets — that model already exists and already works, and the software is a wrapper that sells access to it.

v3 sells three stacked products off one database:

- **The Portfolio** — the finished picks. Lowest ticket, highest churn.
- **The Research Desk** — the library curated per game, per week. Middle.
- **The Vault** — the raw scored library, for people who do their own research. Highest ticket.

The **Z-factor score** is the IP, not win percentage. It weighs sample size and longevity alongside hit rate and recalculates on every result.

## 2. Stack and deploy

| | |
|---|---|
| Framework | Next.js 14.2.35, App Router, React 18.3 |
| Language | TypeScript 5, `strict: true`, path alias `@/* → ./*` |
| Styling | Hand-written CSS custom properties in `app/globals.css`. No Tailwind. |
| Auth | Supabase Auth via `@supabase/ssr` (NextAuth was removed) |
| Database | Supabase Postgres, RLS on every table |
| Payments | Stripe — one-time `payment` today, `subscription` staged |
| Email | Resend (contact form + pick alerts) |
| Push | `web-push` / VAPID, service worker at `public/sw.js` |
| Editor | Tiptap 3 for the blog |
| Hosting | Vercel, auto-deploy from `origin/main` |

What does **not** exist, deliberately or otherwise: no `vercel.json`, no cron jobs, no test runner, no lint config file, no `.env.example`, no migration runner, no CI.

`npm run dev | build | start | lint` are the only scripts, and all four are bare `next` commands.

> [!NOTE]
> Two laptops push to `origin/main`. Always `git fetch` and compare before starting work — this machine has been found several commits behind more than once.

## 3. Repo map

```
app/          routes: pages + API handlers (App Router)
components/   ~49 React components; the big ones are 700-950 lines
lib/          all shared logic — access, offer, stripe, gate, teaser, nfl,
              analytics, notify/, supabase/
hooks/        useCounter, useScrollAnimation
supabase/     schema.sql, betting_tables.sql, migrations/ (applied by hand)
scripts/      *.mjs one-off jobs, all service-role, none wired into npm
data/         seed spreadsheets + the WordPress user CSV
public/       images, sw.js, static og-cover.jpg
docs/         this file
```

## 4. Routes

`force-dynamic` is set where content is gated or admin-editable, because a cached render would serve one member's entitlement to another.

### Public pages

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | `force-dynamic`. Merges `site_content` rows over `SITE_CONTENT_DEFAULTS`. Admins get inline editing. |
| `/portfolio` | `app/portfolio/page.tsx` | `force-dynamic`. The picks. Three-way gate; locked rows redacted to `LockedBetTeaser`. |
| `/portfolio/performance` | `app/portfolio/performance/page.tsx` | `force-dynamic`. Graded results where `show_on_results = true`. |
| `/vault/systems` | `app/vault/systems/page.tsx` | `force-dynamic`. Gated via `partitionBySport()`. |
| `/vault/trends` | `app/vault/trends/page.tsx` | `force-dynamic`. Same gating. |
| `/vault` | `app/vault/page.tsx` | Vault landing. |
| `/desk/[sport]` | `app/desk/[sport]/page.tsx` | The Research Desk week hub, `?week=&type=`. Generalised from `/nfl`; backed by `tier_ladder_06`. |
| `/desk/[sport]/g/[slug]` | `app/desk/[sport]/g/[slug]/page.tsx` | Per-game page. SportsEvent JSON-LD. `writeup_html` is gated. Slugs are frozen at insert for SEO. |
| `/blog` | `app/blog/page.tsx` | Published posts. |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | Dynamic. `generateMetadata()` + Article JSON-LD. Non-members get a 320-char teaser. |
| `/win` | `app/win/page.tsx` | The offer page. `?checkout=<tier>` resumes an interrupted purchase. |
| `/contact` | `app/contact/page.tsx` | Static shell + client form. |
| `/sitemap.xml` | `app/sitemap.ts` | Static routes + every published post + every published NFL game slug. |
| `/robots.txt` | `app/robots.ts` | Disallows `/admin/`, `/account/`, `/api/`. |

> [!WARNING]
> **The route rename is redirected but not swept.** `next.config.js` now carries 308s for all six moved paths (`/betting-systems`, `/betting-trends`, `/model-picks`, `/results`, `/nfl`, `/nfl/games/:slug`), so no URL 404s and the SEO equity carries. But roughly twenty **internal** links still point at the old paths and now take a needless redirect hop: `Footer.tsx`, `Hero.tsx`, `SportsBand.tsx`, `ActionCard.tsx`, `ModelPicksPage.tsx`, `app/sitemap.ts` (which publishes the pre-rename URLs), `lib/site-content.ts`, `lib/notify/message.ts` (every pick notification), and the two links inside the desk game page. `revalidatePath('/results')` in `app/api/admin/content/route.ts` now revalidates a path that no longer exists, so that cache bust silently does nothing.

### Auth pages

All `robots: noindex`. `/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/reset-password`, plus the `app/auth/callback/route.ts` handler. Every `?next=` value passes through `safeNext()`.

### Protected

- `/account` — middleware-guarded **and** re-checked in-page. Profile, entitlement, email/push preferences.
- `/admin`, `/admin/posts/new`, `/admin/posts/[id]/edit` — middleware-guarded **and** `is_admin` re-checked in-page.

Everything else admin-facing is edited **inline on the public pages**, not under `/admin`.

### API handlers

**Stripe** — `POST /api/stripe/checkout`, `POST /api/stripe/webhook`. The webhook is the only path excluded from middleware, by design: it authenticates by signature and must not depend on Supabase Auth being up.

**Admin** (each asserts `is_admin` server-side): `analytics`, `analytics/live`, `todays-bets` + `[id]`, `posts` + `[id]`, `systems` + `[id]` + `import`, `trends` + `[id]` + `import`, `content`, `upload`, `nfl-games/[id]`, `nfl-sync`.

**Public / semi-public**: `POST /api/track`, `POST /api/contact`, `POST|DELETE /api/push/subscribe`, `GET|POST /api/notifications/unsubscribe` (token-based, no session required, so a logged-out click still works).

**EdTheStatBot**: not in this build. The route, its tools and its quota are parked on the `ed-the-statbot` branch. See §8b.

> [!WARNING]
> `GET /api/admin/content` has **no admin check** and returns all site content to any caller. The `PATCH` on the same route is guarded. Low severity — the content is rendered publicly anyway — but it is not the intent of the file.

## 5. Auth and session

### Three clients, three jobs

| File | Key | Use |
|---|---|---|
| `lib/supabase/client.ts` | anon | Browser components |
| `lib/supabase/server.ts` | anon + cookies | Server components, RLS applies |
| `lib/supabase/admin.ts` | service role | Webhooks, gated reads, scripts. Bypasses RLS. |

Gated pages read content through the **service-role** client on purpose: the page's tier logic is the gate, not RLS. `tier_ladder_04` makes RLS agree with the app for the first time, which makes that read optional rather than required — but it stays for now, one change at a time.

### Middleware

`middleware.ts` runs on every request except the Stripe webhook and static assets. It refreshes the session, guards `/admin/*` and `/account/*`, bounces signed-in users away from `/login` and `/signup`, and copies cookies onto redirect responses — a bare `NextResponse.redirect` would drop a just-refreshed session.

It also clears stale auth cookies: when `isStaleRefreshToken(error)` matches, every cookie matching `/^sb-.+-auth-token(\.\d+)?$/` is expired, breaking the loop where a browser replays a retired token and every request 400s.

### The auth timeout hardening

Three commits (`1b6376b`, `318d566`, `ca5a55a`) responding to a real outage on **2026-08-29**: Supabase's `/auth/v1/user` hung for 12–30 seconds while REST stayed at ~0.5s. Vercel kills middleware at 25s, and every dynamic render calls `getUser()` at least twice (layout + page), so the whole site 504'd.

`lib/supabase/auth-timeout.ts`:

- `AUTH_TIMEOUT_MS = 2500`.
- `boundedAuthFetch()` bounds **only** URLs containing `/auth/v1/`. REST is left alone so admin bulk imports aren't capped at 2.5s.
- `withAuthTimeout()` **aborts** on timeout rather than only racing. That is the point of `ca5a55a`: racing alone left the request in flight, so a slow refresh would land after the response was sent, rotate the token, and persist it nowhere — a permanent 400 loop.
- `isStaleRefreshToken()` matches only `refresh_token` error codes or a 400/401 with `/refresh token/i`. **AbortError and network failures deliberately do not match**, so a blip never signs anyone out.

`lib/supabase/server.ts` monkey-patches `getUser` inside the `createClient` factory rather than at the ~37 call sites — so no future call site can forget it. On timeout it returns `{ data: { user: null }, error }`, degrading to logged-out instead of throwing.

Note that `setAll` is a no-op in Server Components. **Middleware is the only place a rotated refresh token can actually be persisted.**

### Flows

`app/actions/auth.ts` holds `login`, `signup`, `loginWithGoogle`, `logout`, `forgotPassword`, `resetPassword`. The password policy (≥8 chars, upper, lower, symbol) is enforced **server-side**, not only in the form. `app/auth/callback/route.ts` writes cookies onto the redirect response and exchanges the code for a session.

`lib/safe-redirect.ts::safeNext()` does one `decodeURIComponent` pass then rejects anything not starting with `/`, plus `//`, `/\`, `://`, control characters, and anything over 512 chars.

### Reading access in a page

Use `lib/access-server.ts` — do not hand-roll the `getUser → select → resolveAccess` block:

```ts
const access = await getAccess()                    // entitlement only
const access = await getAccess({ billing: true })   // + billing state, account page only
const { access, userId, email, fullName } = await getAccessWithProfile()  // nav, one round trip
```

## 6. Data model

**There is no migration runner.** Every `.sql` file is pasted into the Supabase SQL editor by hand, in the order its header specifies. `add_elite_tier.sql` must run **alone** — `ALTER TYPE ... ADD VALUE` cannot run in the same transaction that uses the new value, and the editor wraps every paste in one transaction.

### Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | Auto-created by the `handle_new_user()` trigger. Holds tier, expiry, Stripe ids, admin flag, notification prefs, first-touch attribution. |
| `posts` | Blog | `slug UNIQUE`, `access_level`, `published_at` stamped on first publish. |
| `betting_systems` | The systems library | `code` UNIQUE business key (CFBS0001), `sport` CHECK, W/L/T, `pct`, `min_tier`, `is_free`, `is_elite`, `is_active`, `sort_order`. `line`/`type`/`date`/`team`/`units` were dropped by `vault_02_drop_desk_columns.sql`. |
| `betting_trends` | The trends library | Same, plus `team` — the trends surface groups by it. Its key is `CFBT0001`. |
| `todays_bets` | The picks | `result` defaults `'pending'`; `is_free` defaults **true** here (the other two default false). |
| `nfl_games` | Synced NFL schedule | `writeup_html` is gated IP. Admin-owned columns are never overwritten by a sync. |
| `nfl_game_systems`, `nfl_game_trends` | Curated join tables | |
| `page_views` | Analytics ingest | Insert-anyone, **no select policy**. |
| `events` | Typed events (`checkout_click`) | Service-role only. |
| `purchases` | Revenue ledger | `stripe_session_id UNIQUE` is the idempotency key. |
| `push_subscriptions` | Web push endpoints | `endpoint UNIQUE`; dead rows pruned on 404/410. |
| `site_content` | Admin-editable page copy | `key` / `value jsonb`. |
| `stripe_events` | Webhook replay guard (staged) | Stripe event id as PK. |

> [!WARNING]
> Two schema holes. `supabase/migrations/add_vig_to_todays_bets.sql` is a **0-byte file** even though `vig` is written by the admin API and exists in production. And **`site_content` has no DDL anywhere in the repo** — the table exists only in prod. Rebuilding this database from the files in `supabase/` would not produce a working site.

`betting_tables.sql` **drops the tables first**. Do not re-run it against production.

### RPC functions

All `STABLE`, with `EXECUTE` revoked from `anon` and `authenticated`:

- `analytics_summary(from, to)` — unique visitors, sessions (30-minute gap heuristic via `lag()`), bounce rate, average session length.
- `analytics_timeseries(from, to, bucket)` — `date_trunc` in `America/New_York`.
- `analytics_breakdown(from, to, dim, limit)` — `path | referrer | device | country | utm_source`; referrers normalized to a bare domain.
- `analytics_path_visitors(from, to, path)`
- `active_visitors()` — distinct visitors in the last 5 minutes.
- `recompute_entitlement(user)` — **staged**, see §7.

## 7. Payments and entitlement

### 7a. Deployed today

One-time Stripe payments only. `subscription_tier` is an enum (`free | basic | premium | elite`), `access_expires_at` is the clock, and a purchase sets tier + expiry directly from the price ID.

**Entitlement is `access_expires_at > now()` and nothing else.** `subscription_status` is deliberately never read: the old webhook set it to `'active'` on purchase and never cleared it, so anything gating on it treats lapsed members as paid. There is no cron downgrade job — expiry is evaluated at render time, so it cannot drift.

### 7b. Staged: the v3 ladder (NOT deployed)

Five rungs, each including everything below it:

| Rung | Product | Free? |
|---|---|---|
| `retail` | Vault — Public Intelligence (copy says "free") | yes |
| `portfolio` | The Portfolio | |
| `desk` | The Research Desk | |
| `private` | Vault — Private Intelligence | |
| `institutional` | Vault — Institutional Intelligence | |

Eight SKUs — four paid rungs × two billing periods:

| Rung | Monthly | Mode | Season | Mode |
|---|---|---|---|---|
| Portfolio | $49 | `payment`, 30 days | $199 | `payment`, until |
| Research Desk | $129 | **`subscription`** | $499 | `payment`, until |
| Private | $199 | **`subscription`** | $799 | `payment`, until |
| Institutional | $399 | **`subscription`** | $1,499 | `payment`, until |

Two rules encoded in `lib/offer.ts`: **The Portfolio never recurs**, even monthly. **Season passes are always one-time** — one sale and one dispute window instead of twelve of each, which is why the season pass is the default selection on the pricing toggle.

`SEASON_ENDS_AT = '2027-02-15T12:00:00Z'` must be bumped each season (the Monday after the Super Bowl). If it goes stale, the webhook logs loudly and grants 30 days instead, so a forgotten constant can never sell access that is already expired on arrival.

`skuByPriceId()` returns `undefined` for an unknown price and callers must grant nothing. The old `priceTier()` fell back to the cheapest tier, which meant a mis-set env var quietly sold every buyer the wrong product.

### Two slots, one derived entitlement

`tier_ladder_03` splits the grant into two independent slots on `profiles`:

- `pass_*` — written only by `checkout.session.completed` (mode `payment`) and `charge.refunded`.
- `sub_*` — written only by `customer.subscription.*` and `invoice.*`.

`subscription_tier` and `access_expires_at` become **derived**: `recompute_entitlement(user)` takes the max over whichever slots are currently active, and every webhook handler calls it after writing its one slot. No handler computes a tier or an expiry itself.

Why two slots rather than one `max()`ed column:

1. **Revocation becomes representable.** With one column, `customer.subscription.deleted` has no correct action — subtract a contribution you can't identify, or wipe a season pass the member paid for.
2. **It closes a revenue leak.** One column cannot distinguish "Desk season pass through February" + "Institutional monthly" from a single Institutional grant. Cancel the subscription and the member keeps Institutional until February on the strength of a Desk pass.
3. **Refunds work.** `charge.refunded` clears the pass slot without touching a live subscription.
4. **The anti-downgrade special case disappears.** "Highest active grant wins" is emergent, so the old `TIER_RANK` comparison was deleted rather than ported.

`recompute_entitlement()` gives subscriptions a **3-day grace** past the period end — the invoice webhook can lag, and Stripe smart-retries a failed charge for days. `customer.subscription.deleted` revokes immediately regardless, so the grace only ever covers genuine dunning. When neither slot is live it preserves the last held tier and its past expiry, so `resolveAccess()` reports `'expired'` rather than `'free'` — that distinction drives the Renew copy across the site.

### The webhook

`app/api/stripe/webhook/route.ts` handles six events with **three idempotency layers**:

1. **`stripe_events` insert-first.** A `23505` unique violation returns early, before any grant logic. Covers every event type — `last_stripe_session_id` only ever guarded checkout.
2. **Absolute writes.** Subscription handlers set values read off the event payload, so replaying one is inherently a no-op. The pass path *stacks* days, so it genuinely needs layer 1 plus the session-id guard.
3. **`sub_event_at` watermark.** Stripe does not guarantee ordering; without it a stale `updated` arriving after `deleted` would un-cancel a cancelled subscription.

| Event | Action |
|---|---|
| `checkout.session.completed` | `mode: 'payment'` → resolve price, write the pass slot, ledger row. **`mode: 'subscription'` grants nothing** — `customer.subscription.created` is authoritative. Unknown price → **500, grant nothing**, so Stripe retries and it gets noticed. |
| `customer.subscription.created` / `.updated` | Write the sub slot: tier, status, period end, cancel-at-period-end, watermark. |
| `customer.subscription.deleted` | Clear **only** the sub slot. A season pass survives. |
| `invoice.payment_succeeded` | Update status/tier/period end; ledger row keyed on `stripe_invoice_id`. |
| `invoice.payment_failed` | Set `past_due`. **Does not revoke** — Stripe's retries plus the 3-day grace cover it. Cutting someone off over a transient decline is how you earn a chargeback. |
| `charge.refunded` | **Full refund only** revokes; ends the pass slot now, leaves a subscription alone. A partial refund is usually goodwill. |

### The checkout route

`ALLOWED_PRICES` is derived from `OFFER_SKUS` so it cannot drift from what `/win` renders. Two guards:

1. **Already holds it.** A live pass at or above the rung being bought → `409` with `heldTier` / `heldUntil`. Never create a reason to dispute.
2. **Plan switch on a live subscription.** Opening a second checkout session would create a **second subscription and double-bill**. The route modifies the existing one in place with `proration_behavior: 'always_invoice'` and returns `{ redirect: '/account?updated=1' }`.

Subscription sessions also stamp `subscription_data.metadata`, because `customer.subscription.*` events carry the *subscription's* metadata, not the session's.

### Deploy order

> [!WARNING]
> **Ship the code first, then run the SQL.** New code reads old values — `normalizeTier()` maps `free/basic/premium/elite` onto the ladder. Old code cannot read new values: `TIER_RANK['desk']` is `undefined` and `isPaidTier('desk')` is `false`. A DB-first migration logs every paying member out instantly.

Run order: **00** snapshot (uncomment the block at the top of `tier_ladder_01`, save the output outside the database) → **01** profiles tier → **02** content `min_tier` + **02b** flag-sync trigger → **03** billing slots + **03b** `recompute_entitlement()` → **04** RLS realign → **05** migrate the users.

Steps 01 and 02 drop the two `posts` RLS policies, because Postgres refuses `ALTER COLUMN TYPE` on a column referenced by a policy. **Step 04 recreates them.** Between 01 and 04 the blog's RLS is degraded — users see no change because the blog reads service-role, but do not leave the migration half-applied overnight.

## 8. Content gating

`resolveAccess(profile, isLoggedIn)` in `lib/access.ts` is the one gate. It is a **pure module with no server imports**, so client components can use it too. It returns:

```ts
{ tier, isAdmin, membership, expiresAt, atLeast(required), isPaid, hasElite,
  billing, subStatus, renewsAt, cancelAtPeriodEnd }
```

- `tier: null` means logged out. Expired paid users collapse to `'retail'` — several client components branch on `userTier === null` to mean "logged out", so that shape must not change.
- `isPaid` means "has any paid rung". Correct for nav, CTAs and the account page; **wrong for content gates**, because the Vault library is `private`, the schedule is `desk`, and the picks are `portfolio`. Gate content with `atLeast()`.
- `hasElite` is a deprecated shim for the old `is_elite` flag. It maps to `'private'`, **not** `'institutional'`: the top two rungs differ on *depth* of access (export, query builder, API, backtester), not on which rows exist.
- The billing fields are zeroed unless `BILLING_SELECT` was in the select. `BILLING_SELECT` is deliberately separate from `ACCESS_SELECT` — entitlement must stay a function of `access_expires_at` alone, and `lib/notify/audience.ts` selects `ACCESS_SELECT` across every profile on the site.

### The house rule

> [!IMPORTANT]
> Locked rows are **dropped or redacted server-side**. They are never sent to the browser and hidden with CSS, and teaser objects are built **field by field, never by spread** — the source tables are queried with `select('*')`, so a spread would ship every current and future column to someone who has not paid for it. This applies to `lib/teaser.ts` (`toTeaser`, `toBetTeaser`) and `lib/nfl.ts` (`toPublicGame`, which drops `writeup_html` and replaces it with `has_writeup` + `writeup_words`).

`lib/gate.ts` is where that logic now lives, once, instead of near-byte-identical copies in the systems and trends pages:

- `rowMinTier(row, paidDefault)` reads the new `min_tier` column when it exists and falls back to `is_free` / `is_elite` when it does not — so the app runs correctly both before and after `tier_ladder_02`.
- `partitionBySport(rows, userTier, isAdmin, paidDefault)` returns `{ visible, lockedCounts, teasers, unlockAt }`. Admins see everything. **Inactive rows are never advertised** — an unpublished row must not leak its existence through a count.
- `compareBySample()` — sample size (W+L+T) desc, then win %, then date. This ordering also decides which rows become teasers, so `compareSystems()` in `SportTabsSystem.tsx` mirrors it exactly and the two must not drift.

`paidDefault` differs per table because the legacy defaults differ: systems and trends default `is_free = false` and belong to Private; `todays_bets` defaults `is_free = true` and belongs to the Portfolio.

## 8b. EdTheStatBot — parked

**Not part of the MVP.** The bot was cut from `v3-tier-ladder` so the ladder could
ship on its own, and lives in full on the **`ed-the-statbot`** branch: `app/api/statbot/`,
`lib/ai/*` (tools, quota, thread, model, markdown, page-context), `components/StatBot*.tsx`,
the `ai_usage_*` migrations, and this section of the document with its tool-by-rung table
and its design notes. Read it there before rebuilding any of it.

The homepage teaser went with him in a second pass: `StatBotPreview.tsx`, `StatBotAvatar.tsx`,
its stylesheet, its `statbot_preview` key in `lib/site-content.ts` and its admin editor panel
in `AdminContentTab.tsx`. **The `statbot_preview` row is still in the `site_content` table** —
saves are per-key upserts, so removing the key from the schema does not delete the stored copy,
and the wording Eddie has edited is waiting there when the section returns.

What stays behind on this branch:

- `lib/gate.ts` and `lib/access-server.ts` — the bot leaned on both, but the Vault,
  Desk and Portfolio pages are the primary callers and always were.

What comes back with him: the `ai`, `@ai-sdk/google`, `@ai-sdk/react` and `zod`
dependencies (all four arrived with the bot and left with him), the `AI_GATEWAY_API_KEY` /
`GOOGLE_GENERATIVE_AI_API_KEY` environment variables, and the `ai_usage`, `ai_usage_anon`
and `ai_threads` tables — **applied in production as of 2026-09-04** and simply sitting unused
while he is parked. Either way nothing needs to be un-migrated.

## 9. Content domains

**Picks** (`todays_bets`) — admin-only authoring through `POST /api/admin/todays-bets`, with fields whitelisted explicitly in the route. Read on `/portfolio` (all) and `/portfolio/performance` (`show_on_results = true`). Seed: `scripts/seed-todays-bets.mjs`.

**Systems and trends** — inline admin CRUD from within `SportTabsSystem` / `TrendsFilter`, plus bulk XLSX/JSON import at `/api/admin/{systems,trends}/import`. `clearFirst` on an import wipes the table first. Seed: `scripts/seed-data.mjs` from `data/sample data.xlsx`; wipe: `scripts/clear-data.mjs`.

**Blog** — Tiptap editor under `/admin/posts/*`. Slug collisions return `409` on PG `23505`. Cover images upload to the public `post-images` bucket; when `cover_image` is null, `lib/blog-images.ts::coverForPost()` picks a deterministic one — ordered keyword rules first, then a per-tag pool indexed by an FNV-1a hash **plus the sum of numeric tokens in the slug**, which stops date-series posts from clumping onto the same image. That file carries full Wikimedia/Unsplash attribution for every image.

**NFL** — `POST /api/admin/nfl-sync` pulls ESPN's unofficial scoreboard API, admin-triggered, no cron. Default sweep is regular weeks 1–18 plus postseason 1–5. `parseEvents()` pushes bad events onto a `failed[]` array rather than aborting the run. **Insert and update are split** so admin-owned columns (`slug`, `brief`, `writeup_html`, `is_published`, curated links) are never touched by a sync, and slugs are frozen at insert for SEO. Week selection is derived from the data — nothing hardcodes a week count.

**Editable site copy** — `lib/site-content.ts` defines interfaces and `DEFAULT_*` constants for every editable section; DB rows are merged **over** the defaults at render. `app/page.tsx` deliberately forces `href` / `linkText` / `isExternal` back to the defaults, so an admin edit cannot break navigation.

## 10. Admin and analytics

Admin is a single `is_admin` boolean on `profiles` — no roles table — enforced in **three places**: middleware (session only), each admin page (`redirect('/')`), and each admin API route (`assertAdmin()` → 403).

The dashboard pre-fetches users, posts (paged 1000 at a time) and analytics **in parallel on the server**, so it paints with data instead of hydrating then fetching.

**Ingest** (`lib/analytics.ts`, `app/api/track/route.ts`): `hashVisitor()` is `sha256(salt + NY-date + ip + ua)`. The date component rotates daily, so a visitor id **cannot be joined across days** — Plausible-style, no durable identifier is ever stored. `/admin` paths and bot UAs are silently dropped. `ALLOWED_EVENTS` is exactly `['checkout_click']`. The route also throttles `last_seen_at` to once per 5 minutes and stamps first-touch attribution onto the profile **once ever**, replying `{ stamped: true }` so the client stops sending it.

**Attribution** (`lib/attribution.ts`, client): stores first touch in `localStorage` under `etsm_attr`, and **only** when the landing URL carries UTM params or the referrer is external. Campaign labels only, no identifier.

**Aggregation** (`lib/admin-analytics.ts`): `getRangeAnalytics()` fires 13 queries in one `Promise.all` over the RPCs; chart buckets are NY-midnight aligned and **zero-filled** so gaps render as zero rather than closing up. Week = 7 days, month = 30 days, year = 52 ISO weeks anchored on Mondays.

Both admin analytics routes fire the `is_admin` lookup **in parallel** with the data queries, with a `.catch(() => {})` so a 403 doesn't leave an unhandled rejection — deliberate, because `/live` is polled every 30 seconds.

> [!NOTE]
> The analytics route swallows RPC errors: a database failure renders as **zeros, not an error**. If numbers look wrong, probe the database directly before debugging the UI.

## 11. Notifications

Fire on a pick **insert** only (`POST /api/admin/todays-bets`), and are **awaited** rather than fire-and-forget — on Vercel the function can be frozen once the response is returned. `body.notify === false` saves silently. Updates via `PUT` never notify.

`notifyNewPick()` **never throws**. `NOTIFICATIONS_ENABLED=false` is the global kill switch. Each of the three channels is wrapped in `guard()` and they run in `Promise.all`, so one failure cannot take down the others.

**Audience fails closed.** `audienceForPick()` treats anything not explicitly `is_free` as paid, and returns `null` for elite picks (notify nobody, for now). `recipientsFor()` runs every profile through `resolveAccess(row, true).isPaid`, so lapsed members are excluded — filtering on `subscription_tier` alone would notify people who can no longer open the pick.

**`lib/notify/message.ts` is the single place that decides what a notification may say.** `renderPick()` returns `detail: null` for gated audiences *no matter which channel asks*, and `body` deliberately carries no odds — gambling odds in an email body trip spam filters.

Per-channel details worth keeping:

- **Discord**: the role ping must sit in `content`, not inside the embed, or Discord won't push it to devices. `allowed_mentions: { parse: [], roles: [roleId] }` both makes the ping land regardless of the role's mentionable flag and pins the blast radius, so a stray `@everyone` in pick text cannot go out. The server has no tier separation, so gated picks post teaser-only.
- **Email** (Resend): individually addressed, never a shared To/BCC. Chunked at 100 with 600ms between chunks and up to 4 attempts, backing off **on rate limits only**. A failed chunk is recorded and the loop continues. Table-based HTML with a hard-coded palette — email clients cannot read CSS custom properties. Sets `List-Unsubscribe` and `List-Unsubscribe-Post`.
- **Push**: chunks of 50 with `Promise.allSettled`. **404/410 prunes the dead subscription row** — the only cleanup path that table gets. `public/sw.js` sets `tag: 'ets-pick'` with `renotify: true`; without `renotify`, pick 2 of a slate lands silently.

## 12. Environment variables

No `.env.example` exists. This table is it.

### Public — inlined into the client bundle

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | every Supabase client, middleware, scripts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server clients, middleware |
| `NEXT_PUBLIC_SITE_URL` | auth redirects, Stripe success/cancel URLs, notification links |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push subscribe |
| `NEXT_PUBLIC_STRIPE_PORTFOLIO_MONTH_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_PORTFOLIO_SEASON_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_DESK_MONTH_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_DESK_SEASON_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_PRIVATE_MONTH_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_PRIVATE_SEASON_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_INSTITUTIONAL_MONTH_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_INSTITUTIONAL_SEASON_PRICE_ID` | `lib/offer.ts` |
| `NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID` | `legacyPriceGrant()` — **legacy, still required** |
| `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` | `legacyPriceGrant()` — **legacy, still required** |
| `NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID` | `legacyPriceGrant()` — **legacy, still required** |

### Server-only

| Var | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts`, all scripts |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | the webhook route |
| `AI_GATEWAY_API_KEY` | **Unused in this build** — EdTheStatBot is parked on `ed-the-statbot` (§8b). Required again only when he returns. |
| `RESEND_API_KEY` | contact form + pick email |
| `RESEND_BATCH_LIMIT` | test-only; leave unset in production |
| `ANALYTICS_SALT` | `hashVisitor()` |
| `DISCORD_WEBHOOK_URL` | `lib/notify/discord.ts` |
| `DISCORD_FREE_ROLE_ID` | `lib/notify/discord.ts` |
| `DISCORD_MEMBERS_ROLE_ID` | `lib/notify/discord.ts` |
| `VAPID_PRIVATE_KEY` | `lib/notify/push.ts` |
| `VAPID_SUBJECT` | defaults to `mailto:ed@edthestatman.com` |
| `NOTIFICATIONS_ENABLED` | only the literal `'false'` disables |

The three legacy Stripe price IDs must stay set in production: a checkout session created before the cutover can still complete afterwards, and grandfathered members are on them.

> [!WARNING]
> **Never mark a `NEXT_PUBLIC_*` variable as "Sensitive" in Vercel.** Sensitive values are not exposed at build time, so Next silently inlines `undefined` — the variable becomes an empty string in the browser bundle with no error anywhere. Price IDs are the ones that bite.

`process.env` must be read as a **literal static member expression**. Never index it dynamically — Next only inlines `NEXT_PUBLIC_*` when it can see the full name in the source.

## 13. Operations

### Local development

`npm run dev` → http://localhost:3000.

> [!WARNING]
> **`.env.local` holds live production credentials** — the real Supabase project, a `sk_live_` Stripe key, and the real Resend key. There is no sandbox. Anything run locally writes to the production database and sends real email to real members. Treat every local script run as a production change. `NEXT_PUBLIC_SITE_URL` is still `localhost:3000`, so links in locally-sent email point at localhost.

Windows note: stopping `npm run dev` can orphan the child node process holding port 3000. Clear it with `Get-NetTCPConnection -LocalPort 3000` then `Stop-Process`.

### Scripts

All of `scripts/*.mjs` load `.env.local`, use the service-role key, and are run directly (`node scripts/x.mjs`) — none are wired into npm.

| Script | Does |
|---|---|
| `seed-data.mjs` | Seeds systems + trends from `data/sample data.xlsx` |
| `seed-todays-bets.mjs` | Seeds a hard-coded slate |
| `clear-data.mjs` | Truncates both betting tables |
| `import-wp-users.mjs` | Migrates ~197 WordPress users |
| `add-premium-users.mjs` | Creates pre-confirmed users with a tier + expiry |
| `add-march23-views.mjs` | One-off analytics backfill |

**WordPress migration**, two password paths. `$wp$2y$…` (WP 6.8+ bcrypt) — strip the `$wp` prefix and import via `auth.admin.createUser({ password_hash })`; the user's existing password keeps working and they never notice. `$P$…` (phpass/MD5) — Supabase cannot verify these, so the user is imported with `email_confirm: true` and sent a reset email.

### Grandfathering legacy members

Existing members hold one-time passes, so there is no recurring price to freeze — their access simply runs out. To honour their old price: create one-time prices on the new products at the old amounts ($19.99 → Desk, $119.99 → Private, $249 → Institutional) with `metadata { legacy: 'true' }`, generate a Payment Link for each, and email it as their pass nears expiry. Zero application code, no risk of a public price leak, and the legacy price IDs are already wired into `legacyPriceGrant()`.

## 14. Known gaps

- **The v3 ladder is staged, not shipped.** Nothing is committed and no SQL is applied. Production is still on `free/basic/premium/elite` with one-time payments.
- **~20 internal links still point at pre-rename paths**, and `app/sitemap.ts` publishes them. Redirects cover correctness; this is a hop and a sitemap bug. See §4.
- **`lib/supabase/types.ts` covers the ladder but not the tables.** `SubscriptionTier` and `AccessLevel` are on the v3 ladder, but there are still no entries for `todays_bets`, `betting_systems`, `betting_trends`, `nfl_games`, `push_subscriptions`, `site_content` or `stripe_events` — which is why so many call sites cast `(supabase as any)`.
- **`getGlobalTotals()` counts paid users with `.in('subscription_tier', ['basic','premium','elite'])`** — it will report zero paying users the moment the ladder migration runs.
- **Slice 2 is not done.** `TodaysBets`, `TrendsFilter` and both XLSX importers still write `is_free` / `is_elite`. The `02b` compatibility trigger keeps `min_tier` in step until they are converted, and **must be dropped** when they are.
- **`GET /api/admin/content` has no admin check.**
- **`site_content` has no migration** and `add_vig_to_todays_bets.sql` is empty. The repo cannot rebuild the database.
- **ESPN host migration is done in `lib/espn.ts` but the NFL section is mid-rewrite.** `site.api.espn.com` began returning 403 (probed 2026-08-31: `cdn.espn.com`, `sports.core.api.espn.com` and `example.com` all returned 200 from the same machine, so it is not connectivity). `cdn.espn.com` is now primary with `site.api` kept as fallback, and it returns *more* than the old host did: spread, moneyline and total with **both open and close** prices, which removes the need for a paid odds vendor. `/nfl` is being generalised to `/desk/[sport]`, backed by `tier_ladder_06_desk_games.sql` — which is independent of steps 01-05 and can be applied any time, since all its columns are nullable and read defensively.
- **Four components have zero importers**: `AdminContentTab`, `AdminEditOverlay`, `SystemsOverview`, `ActionCard`. `AdminSystemsTab` and `AdminTrendsTab` are imported only for their types. (`StatBotPreview` is gone from this branch entirely, with the bot it previewed — §8b.)
- **The Institutional card still oversells.** `lib/offer.ts` promises a backtester and an API key; neither exists, and with EdTheStatBot parked (§8b) the export and query-builder tools that did exist are not in this build either.
- **No tests, anywhere.** `npx tsc --noEmit` is the only automated check, and it currently passes on application code (the only errors are stale `.next/types/**` artifacts, which clear on the next build).
- **A checked-in `.git-elenos-backup/` directory** is tracked in git and should not be.

## 15. Open loops

- [ ] Add `next.config.js` redirects for the four renamed routes and sweep the ~20 stale internal links
- [ ] Fix the `/portfolio` canonical URL still pointing at `/model-picks`
- [ ] Create the eight Stripe prices and set the eight new env vars in Vercel (**not** Sensitive)
- [ ] Run the tier ladder migration: code deploy first, then SQL 00→05, verifying between each
- [ ] Update `getGlobalTotals()` to use `isPaidTier()` before the migration runs
- [ ] Regenerate `lib/supabase/types.ts` and drop the `(supabase as any)` casts
- [ ] Slice 2: convert the admin editors and importers to write `min_tier`, then drop the `02b` triggers
- [ ] Migrate the remaining `hasElite` call sites to `atLeast('private')` and delete the shim
- [ ] Add an admin check to `GET /api/admin/content`
- [ ] Write the missing `site_content` DDL and fill in `add_vig_to_todays_bets.sql`
- [ ] Switch the NFL sync to `cdn.espn.com`
- [ ] Bump `SEASON_ENDS_AT` after the Super Bowl
