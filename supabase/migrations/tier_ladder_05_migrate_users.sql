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
