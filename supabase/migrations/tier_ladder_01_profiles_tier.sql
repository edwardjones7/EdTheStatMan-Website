-- ===========================================================================
-- v3 TIER LADDER -- STEP 1 of 5
-- ===========================================================================
-- Apply these by hand in the Supabase SQL editor, IN ORDER, one paste at a
-- time, verifying between each. This repo has no migration runner.
--
--   00 snapshot            (the block at the top of this file -- run it FIRST)
--   01 profiles tier       (this file)
--   02 content min_tier    + 02b flag-sync trigger
--   03 billing slots       + 03b recompute_entitlement()
--   04 RLS realign         <-- recreates policies dropped in 01 and 02
--   05 migrate the 7 users
--
-- DEPLOY ORDER MATTERS: ship the CODE first, then run this SQL. New code reads
-- old values (normalizeTier() in lib/access.ts maps free/basic/premium/elite
-- onto the ladder); old code cannot read new values -- TIER_RANK['desk'] is
-- undefined and isPaidTier('desk') is false, so a DB-first migration would log
-- all 7 paying members out instantly.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 0 -- RUN THIS BLOCK ON ITS OWN, FIRST.
-- Seven paying members and no point-in-time restore worth the name. Thirty
-- seconds of insurance before an irreversible column-type change.
-- ---------------------------------------------------------------------------
--
-- CREATE TABLE IF NOT EXISTS public.tier_migration_audit AS
-- SELECT id, email, subscription_tier, subscription_status, access_expires_at,
--        stripe_customer_id, last_stripe_session_id, now() AS snapshot_at
-- FROM public.profiles;
--
-- -- Save this result set OUTSIDE the database before continuing.
-- SELECT email, subscription_tier, subscription_status, access_expires_at,
--        access_expires_at > now() AS still_valid
-- FROM public.profiles
-- WHERE subscription_tier <> 'free'
-- ORDER BY access_expires_at;
--
-- Uncomment, run, save the output, then re-comment and run STEP 1 below.
-- Drop tier_migration_audit only after a week of clean production.


-- ---------------------------------------------------------------------------
-- STEP 1 -- profiles.subscription_tier: enum -> text + CHECK, remapped.
-- ---------------------------------------------------------------------------
--
-- WHY TEXT INSTEAD OF ADDING ENUM VALUES:
--   `ALTER TYPE ... ADD VALUE` cannot run in the same transaction that uses the
--   new value, and the Supabase SQL editor wraps every paste in one
--   transaction. See the header of add_elite_tier.sql for the last time this
--   cost us a deploy. text + CHECK makes every future rung change one ordinary
--   statement instead of a two-paste dance.
--
-- LANDMINE: Postgres refuses `ALTER COLUMN ... TYPE` on a column referenced by
-- an RLS policy ("cannot alter type of a column used in a policy definition").
-- The posts policies from schema.sql and add_elite_posts_rls.sql both reference
-- profiles.subscription_tier, so they are dropped here and RECREATED IN STEP 4.
-- Between this step and step 4 the blog's RLS is degraded. The blog pages read
-- via the service-role client so users see no change, but DO NOT leave the
-- migration half-applied overnight.

BEGIN;

DROP POLICY IF EXISTS "Members can view all published posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view published free posts" ON public.posts;

ALTER TABLE public.profiles ALTER COLUMN subscription_tier DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN subscription_tier TYPE text USING subscription_tier::text;

-- This mapping is mirrored by normalizeTier() in lib/access.ts.
-- Change both together.
UPDATE public.profiles SET subscription_tier = CASE subscription_tier
  WHEN 'free'    THEN 'retail'
  WHEN 'basic'   THEN 'desk'
  WHEN 'premium' THEN 'private'
  WHEN 'elite'   THEN 'institutional'
  ELSE 'retail'
END;

ALTER TABLE public.profiles ALTER COLUMN subscription_tier SET DEFAULT 'retail';
ALTER TABLE public.profiles ALTER COLUMN subscription_tier SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('retail','portfolio','desk','private','institutional'));

-- subscription_status changes meaning: it is now the Stripe SUBSCRIPTION
-- status, and NULL for pass-only members. It is still never read for
-- entitlement -- access_expires_at remains the only input to that.
--
-- It must become text: Stripe emits 'unpaid', 'incomplete_expired' and
-- 'paused', none of which exist in the subscription_status enum. Writing one
-- would raise inside the webhook, return non-2xx, and put Stripe into an
-- infinite retry loop against a handler that can never succeed.
ALTER TABLE public.profiles ALTER COLUMN subscription_status DROP DEFAULT;
ALTER TABLE public.profiles
  ALTER COLUMN subscription_status TYPE text USING subscription_status::text;

COMMIT;

-- VERIFY -- expect only ladder values, with counts matching your step 0 snapshot:
--   SELECT subscription_tier, count(*) FROM public.profiles GROUP BY 1 ORDER BY 1;
--
-- The `subscription_tier` and `subscription_status` enum TYPES are now
-- vestigial. Leave them in place: dropping them buys nothing, and retrying a
-- failed step is easier if they still exist.
