# Migration runbook

There is no migration runner in this project. Every file in `supabase/migrations/`
is applied **by hand, in order, in the Supabase SQL editor**. This document is the
order and the verification.

Verified against production on **2026-09-02**: none of the `tier_ladder_*` steps
below had been applied. The application code is written to survive that (see
"Why nothing is broken today").

> **Steps 7 and 8 are not on this branch.** EdTheStatBot was cut from the MVP and
> lives on `ed-the-statbot`, and the `ai_usage_*` files went with him. The tables
> they create were applied in production as of **2026-09-04** and simply sit unused — there is
> nothing to un-migrate, and nothing here to run. They are documented below for
> when he comes back.

---

## Before anything

**Ship the application code first, then run the SQL.** New code reads old values
(`normalizeTier()` maps `free`/`basic`/`premium`/`elite` onto the ladder); old
code cannot read new ones — `TIER_RANK['desk']` is `undefined` and
`isPaidTier('desk')` is `false`, so a DB-first migration logs every paying member
out instantly.

**Step 0 is the snapshot.** It is the commented block at the top of
`tier_ladder_01_profiles_tier.sql`. Uncomment it, run it, save the result set
**outside** the database, re-comment it, then start step 1. Step 5's verification
joins against the `tier_migration_audit` table it creates, so skipping step 0
means there is no way to prove afterwards that nobody's access changed.

## The order

| # | Paste | What it does |
|---|---|---|
| 0 | snapshot block at the top of `tier_ladder_01` | `tier_migration_audit` + the pre-migration report |
| 1 | `tier_ladder_01_profiles_tier.sql` | `subscription_tier` enum → text + CHECK, remapped onto the ladder |
| 2 | `tier_ladder_02_content_min_tier.sql` (main) | Adds `min_tier` to the content tables, backfilled from `is_free` / `is_elite` |
| 2b | same file, below the `STEP 2b` marker | Flag-sync trigger |
| 3 | `tier_ladder_03_billing_slots.sql` (main) | Pass/subscription billing columns, `stripe_events`, `purchases` columns |
| 3b | same file, below the `STEP 3b` marker | `recompute_entitlement()` |
| 4 | `tier_ladder_04_rls_realign.sql` | **Recreates the `posts` policies dropped in steps 1 and 2** |
| 5 | `tier_ladder_05_migrate_users.sql` | Moves existing paying members into the pass slot |
| 6 | `tier_ladder_06_desk_games.sql` | `nfl_games` sport columns + `desk_notes` |
| ~~7~~ | `ai_usage_01_quota.sql` (two pastes) | EdTheStatBot per-member daily quota — **on `ed-the-statbot`, already applied in prod** |
| ~~8~~ | `ai_usage_02_anon_and_threads.sql` (two pastes) | Anonymous quota + conversation persistence — **same** |

### Steps 1 through 5 are ONE SESSION. Do not stop in the middle.

Postgres refuses `ALTER COLUMN ... TYPE` on a column an RLS policy references, so
step 1 **drops the `posts` SELECT policies** and step 4 is what puts them back.
Between those two steps the blog's row-level security is degraded. The blog pages
read through the service-role client, so nothing visibly changes — which is
exactly why this is easy to walk away from and leave overnight. Don't.

Steps 6, 7 and 8 are independent and can be applied at any time, in any order,
before or after the ladder.

> Steps 7 and 8 each contain **two pastes**, split where the file says. The split
> exists so a `$$` quoting error in a function body cannot roll back the table
> DDL that preceded it.

---

## Why nothing is broken today

Deliberate, and worth not undoing:

- **`normalizeTier()`** (`lib/access.ts`) maps the legacy values — `free`, `basic`,
  `premium`, `elite` — onto the ladder, so unmigrated profile rows resolve correctly.
- **`rowMinTier()`** (`lib/gate.ts`) reads `min_tier` when the column exists and
  falls back to `is_free` / `is_elite` when it does not, using the same mapping
  the migration itself uses.
- **`consumeQuota()`** (`lib/ai/quota.ts`, on `ed-the-statbot`) **fails open** and
  logs `[statbot] quota check failed, allowing through`. It fails open because
  refusing paying members over an outstanding migration is the worse failure —
  which means that on the bot branch, **step 7 is what stands between
  `/api/statbot` and an uncapped model bill.** `consumeAnonQuota()` is the
  opposite and fails closed. Neither runs in this build.

---

## Re-running a step

**Every step is idempotent. Re-running one is safe and is the correct response
to a failure partway through.** Steps 1, 2 and 3 originally used bare
`ADD CONSTRAINT`, which is the one statement in the ladder with no
`IF NOT EXISTS` form; a second run died on
`42710: constraint "..." already exists`. Each is now preceded by
`DROP CONSTRAINT IF EXISTS`, the same pattern step 6 always used.

**A constraint that already exists means the transaction that created it
committed.** Steps 1 through 3 are each wrapped in `BEGIN`/`COMMIT`, so they
are all-or-nothing: if you can see the constraint, that whole step landed and
the re-run was not needed. The exception is running a hand-selected fragment of
a file rather than the whole paste.

Run this to see exactly where you are, rather than inferring it:

```sql
-- Step 1: the tier column is text, holding ladder values
SELECT data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_tier';
SELECT DISTINCT subscription_tier FROM public.profiles;

-- Step 2: min_tier on all three content tables (expect 3 rows)
SELECT table_name FROM information_schema.columns
 WHERE table_schema='public' AND column_name='min_tier'
   AND table_name IN ('betting_systems','betting_trends','todays_bets');

-- Step 3: the seven billing columns (expect 7 rows)
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles'
   AND column_name IN ('pass_tier','pass_expires_at','sub_tier','sub_current_period_end',
                       'sub_cancel_at_period_end','sub_event_at','billing_mode')
 ORDER BY column_name;
SELECT to_regclass('public.stripe_events');

-- Step 3b: the function exists (expect 1 row)
SELECT proname FROM pg_proc WHERE proname='recompute_entitlement';

-- Step 4: both posts policies are back (expect 2 rows)
SELECT policyname FROM pg_policies WHERE tablename='posts';

-- Step 5: nobody is left on a legacy tier (expect 0 rows)
SELECT id, subscription_tier FROM public.profiles
 WHERE subscription_tier IN ('free','basic','premium','elite');
```

---

## Verifying, per step

Run these in the SQL editor after each block. Each should return a row, not an error.

```sql
-- 1
SELECT DISTINCT subscription_tier FROM public.profiles;
-- expect only: retail | portfolio | desk | private | institutional (after step 5)

-- 2
SELECT column_name FROM information_schema.columns
WHERE table_name = 'betting_systems' AND column_name = 'min_tier';

-- 3
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('billing_mode', 'pass_tier', 'sub_tier');

-- 4  (the important one: these must exist again after step 4)
SELECT policyname FROM pg_policies WHERE tablename = 'posts';
-- expect: "Anyone can view published retail posts"
--         "Members can view posts at or below their tier"

-- 5  -- run all three VERIFY queries at the bottom of the file itself.
--    Every one must return ZERO rows. They join tier_migration_audit, so they
--    only work if step 0 was run.

-- 6
SELECT to_regclass('public.desk_notes'), to_regclass('public.nfl_games');

-- 7 and 8 apply only on the `ed-the-statbot` branch. Both are already applied in
-- production; these are the checks to re-run when the bot returns.

-- 7
SELECT to_regclass('public.ai_usage');
SELECT * FROM public.consume_ai_quota('<a real user id>'::uuid, 3);  -- run 4x
-- expect allowed=true used=1,2,3 then allowed=false used=3 remaining=0
DELETE FROM public.ai_usage WHERE user_id = '<a real user id>';      -- reset

-- 8
SELECT to_regclass('public.ai_usage_anon'), to_regclass('public.ai_threads');
SELECT * FROM public.consume_ai_quota_anon('test-hash', 2);          -- run 3x
DELETE FROM public.ai_usage_anon WHERE ip_hash = 'test-hash';        -- reset
```

The one-shot check for whether the whole thing landed:

```sql
SELECT
  to_regclass('public.ai_usage')       AS ai_usage,
  to_regclass('public.ai_usage_anon')  AS ai_usage_anon,
  to_regclass('public.ai_threads')     AS ai_threads,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'betting_systems' AND column_name = 'min_tier') AS has_min_tier,
  (SELECT count(*) FROM pg_proc WHERE proname = 'consume_ai_quota')    AS has_quota_fn;
```

All five non-null / non-zero means every step above is in.

---

## After the ladder is applied

Two follow-ups that are easy to forget:

1. **Delete the fallbacks.** `rowMinTier()`'s `is_free` / `is_elite` branch and
   `LEGACY_TIER` in `lib/access.ts` exist only to bridge the gap. Once step 5 is
   verified they are dead weight that quietly hides a mis-migrated row.
2. **`access.hasElite`** is a deprecated shim mapping to `private`. Migrate call
   sites to `atLeast('private')`.

## Operational note: the AI Gateway (parked with the bot)

None of this is live on this branch — it applies on `ed-the-statbot`.

EdTheStatBot's model strings (`anthropic/claude-opus-5`, …) resolve through the
**Vercel AI Gateway**, not a provider SDK. On Vercel this authenticates via OIDC
with no key in the app. Locally it needs either a valid `VERCEL_OIDC_TOKEN`
(refreshed by `vercel env pull`, expires roughly every 12 hours) or an
`AI_GATEWAY_API_KEY` in `.env.local`. Neither the gateway key nor the token is
required for anything else in the project, so a missing one shows up only as
EdTheStatBot failing while the rest of the site is fine.

## Housekeeping

`public.prune_ai_usage_anon(keep_days integer DEFAULT 30)` deletes stale
anonymous counter rows. With the bot parked nothing writes them, so there is
nothing to prune until he returns. Nothing calls it automatically — run it from the SQL
editor occasionally, or attach it to `pg_cron` if that is ever enabled on this
project.
