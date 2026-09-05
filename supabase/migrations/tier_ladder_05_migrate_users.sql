-- ===========================================================================
-- v3 TIER LADDER -- STEP 5 of 5. Run after step 4 commits.
-- ===========================================================================
-- Moves the existing paying members into the PASS slot.
--
-- Every purchase to date was Stripe `mode: 'payment'` -- one-time, already
-- collected. Nobody has a subscription yet, so sub_* stays NULL for everyone
-- and no Stripe-side change is required for the migration itself.
--
-- Step 1 already remapped subscription_tier onto the ladder
-- (basic -> desk, premium -> private, elite -> institutional), so this is a
-- copy into the slot rather than a second remapping.
--
-- Effective access MUST NOT CHANGE for anyone. The verification block at the
-- bottom proves that; run it before you touch anything in Stripe.
-- ===========================================================================

BEGIN;

UPDATE public.profiles
SET pass_tier           = subscription_tier,
    pass_expires_at     = access_expires_at,
    sub_tier            = NULL,
    -- Legacy 'active' was set on purchase and never cleared. The column now
    -- means "live Stripe subscription", and none of these members has one.
    subscription_status = NULL,
    billing_mode        = CASE WHEN access_expires_at > now() THEN 'pass' ELSE 'none' END
WHERE subscription_tier <> 'retail'
  AND access_expires_at IS NOT NULL;

-- A paid tier with no expiry at all is a data artifact. Leave it lapsed, but
-- keep the tier so resolveAccess() still reports membership 'expired' rather
-- than 'free' -- that distinction drives the Renew copy across the site.
UPDATE public.profiles
SET pass_tier           = subscription_tier,
    subscription_status = NULL,
    billing_mode        = 'none'
WHERE subscription_tier <> 'retail'
  AND access_expires_at IS NULL;

COMMIT;


-- ---------------------------------------------------------------------------
-- VERIFY -- run all three. Every one must return ZERO rows.
-- ---------------------------------------------------------------------------

-- 1. Nobody's tier or expiry drifted from the step 0 snapshot.
SELECT p.email,
       a.subscription_tier AS was,  p.subscription_tier AS now_tier,
       a.access_expires_at AS was_exp, p.access_expires_at AS now_exp
FROM public.profiles p
JOIN public.tier_migration_audit a ON a.id = p.id
WHERE p.access_expires_at IS DISTINCT FROM a.access_expires_at
   OR p.subscription_tier <> CASE a.subscription_tier
        WHEN 'free'    THEN 'retail'
        WHEN 'basic'   THEN 'desk'
        WHEN 'premium' THEN 'private'
        WHEN 'elite'   THEN 'institutional'
        ELSE 'retail' END;

-- 2. recompute_entitlement() is a no-op for every migrated member. If this
--    changes anything, the slot model and the snapshot disagree -- STOP.
SELECT public.recompute_entitlement(id)
FROM public.profiles
WHERE pass_tier IS NOT NULL;

--    ...then re-run query 1. Still zero rows.

-- 3. Slots and derived columns are consistent.
SELECT email, subscription_tier, access_expires_at, pass_tier, pass_expires_at,
       sub_tier, billing_mode
FROM public.profiles
WHERE subscription_tier <> 'retail'
  AND (pass_tier IS DISTINCT FROM subscription_tier
       OR pass_expires_at IS DISTINCT FROM access_expires_at);

-- ---------------------------------------------------------------------------
-- IF STEP 0 WAS NEVER RUN -- the fallback verification (used 2026-09-05)
-- ---------------------------------------------------------------------------
-- VERIFY 1 above joins tier_migration_audit and fails with
-- `42P01: relation "public.tier_migration_audit" does not exist` when the step 0
-- snapshot was skipped. That error lands AFTER the COMMIT on line 41, so the two
-- UPDATEs are already applied; what is lost is the verification, not the data.
--
-- Do NOT create tier_migration_audit now to satisfy VERIFY 1. Step 1 already
-- rewrote subscription_tier onto the ladder, so a table captured today holds
-- ladder values, and VERIFY 1's CASE maps every one of them through its ELSE to
-- 'retail'. It would report every paying member as drifted. The before-picture
-- is genuinely unrecoverable; do not fake one.
--
-- WHAT IS STILL PROVABLE, AND WHY IT IS ENOUGH.
-- The two UPDATEs above write pass_tier, pass_expires_at, sub_tier,
-- subscription_status and billing_mode. They do not write subscription_tier or
-- access_expires_at. resolveAccess() reads access_expires_at and nothing else.
-- So the data migration CANNOT have changed anyone's access, by inspection of
-- the SQL rather than by comparison against a snapshot.
--
-- The one remaining step that can move a member is recompute_entitlement(),
-- which writes both derived columns. So: capture, run it, diff.

-- A. Did the UPDATEs land? One statement -- the SQL editor only renders the last.
WITH checks AS (
  SELECT 1 AS n, 'paid members not yet in pass slot (need 0)' AS stage,
         (SELECT count(*)::text FROM public.profiles
           WHERE subscription_tier <> 'retail' AND pass_tier IS NULL) AS result
  UNION ALL SELECT 2, 'members now holding a pass',
         (SELECT count(*)::text FROM public.profiles WHERE pass_tier IS NOT NULL)
  UNION ALL SELECT 3, 'legacy subscription_status left (need 0)',
         (SELECT count(*)::text FROM public.profiles
           WHERE pass_tier IS NOT NULL AND subscription_status IS NOT NULL)
)
SELECT stage, result FROM checks ORDER BY n;

-- B. Capture the state immediately BEFORE recompute_entitlement() runs.
--    access_expires_at has not been written by any ladder step, so this column
--    is still its pre-migration value and the diff in D is meaningful.
CREATE TABLE IF NOT EXISTS public.tier_migration_recheck AS
SELECT id, email, subscription_tier, access_expires_at,
       pass_tier, pass_expires_at, sub_tier, billing_mode, now() AS captured_at
FROM public.profiles;

-- C. The call that VERIFY 2 never reached.
SELECT public.recompute_entitlement(id)
FROM public.profiles
WHERE pass_tier IS NOT NULL;

-- D. Nobody moved. MUST return zero rows.
SELECT p.email,
       b.subscription_tier AS tier_before, p.subscription_tier AS tier_after,
       b.access_expires_at AS exp_before,  p.access_expires_at AS exp_after,
       b.billing_mode      AS mode_before, p.billing_mode      AS mode_after
FROM public.profiles p
JOIN public.tier_migration_recheck b ON b.id = p.id
WHERE p.subscription_tier IS DISTINCT FROM b.subscription_tier
   OR p.access_expires_at IS DISTINCT FROM b.access_expires_at;

-- E. VERIFY 3 from above, which needs no snapshot. Also zero rows.
SELECT email, subscription_tier, access_expires_at, pass_tier, pass_expires_at,
       sub_tier, billing_mode
FROM public.profiles
WHERE subscription_tier <> 'retail'
  AND (pass_tier IS DISTINCT FROM subscription_tier
       OR pass_expires_at IS DISTINCT FROM access_expires_at);

-- Keep tier_migration_recheck for a week of clean production, then:
--   DROP TABLE public.tier_migration_recheck;

-- ---------------------------------------------------------------------------
-- GRANDFATHERING (Stripe side, no app code)
-- ---------------------------------------------------------------------------
-- These members hold one-time passes, so there is no recurring price to freeze
-- -- their access simply runs out. To honour "grandfathered on their current
-- price", create three one-time prices on the NEW products at the OLD amounts
-- ($19.99 -> Desk, $119.99 -> Private, $249 -> Institutional) with
-- metadata { legacy: 'true' }, generate a Stripe Payment Link for each, and
-- email the link to each member as their pass approaches expiry.
--
-- Zero application code, no risk of a public price leak, and the legacy price
-- IDs are already wired into legacyPriceGrant() in lib/stripe.ts so the webhook
-- grants the right rung when one is used.
