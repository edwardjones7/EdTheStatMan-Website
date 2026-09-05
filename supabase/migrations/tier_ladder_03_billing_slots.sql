-- ===========================================================================
-- v3 TIER LADDER -- STEP 3 of 5. Run after step 2 commits.
-- ===========================================================================
-- TWO INDEPENDENT GRANT SLOTS, ONE DERIVED ENTITLEMENT.
--
--   pass_*  written ONLY by checkout.session.completed (mode 'payment')
--           and charge.refunded. One-time purchases: the $49/$199 Portfolio
--           and every season pass.
--   sub_*   written ONLY by customer.subscription.* and invoice.*.
--           The monthly Desk / Private / Institutional subscriptions.
--
--   subscription_tier + access_expires_at are DERIVED: the max over whichever
--   slots are currently active. Computed by recompute_entitlement() below,
--   which every webhook handler calls after writing its one slot.
--
-- THE READ PATH IS UNCHANGED. resolveAccess() in lib/access.ts still decides
-- access from `access_expires_at > now()` and nothing else. It never learns
-- what a subscription is.
--
-- WHY TWO SLOTS RATHER THAN ONE max()ed COLUMN:
--
--   1. Revocation becomes representable. With one shared column,
--      customer.subscription.deleted has no correct action: subtract the
--      subscription's contribution (you do not know what it was) or wipe the
--      field (destroying a season pass the member paid for).
--
--   2. It closes a real revenue leak. One column cannot distinguish
--        "Desk season pass through Feb" + "Institutional monthly"
--      from a single Institutional grant. Cancel the subscription and the
--      member keeps INSTITUTIONAL until February on the strength of a DESK
--      pass. Two slots drop them to desk correctly.
--
--   3. Refunds work. charge.refunded clears the pass slot without touching a
--      live subscription.
--
--   4. The anti-downgrade special case disappears. "Highest active grant wins"
--      is emergent from recompute_entitlement(), so the
--      TIER_RANK[existing] > TIER_RANK[incoming] block in the old webhook is
--      deleted, not ported.
--
--   This codebase already has the mirror-image bug: subscription_status was set
--   to 'active' and never cleared, which is exactly why resolveAccess() was
--   forced to ignore it. Do not build that trap a second time.
-- ===========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pass_tier                text,
  ADD COLUMN IF NOT EXISTS pass_expires_at          timestamptz,
  ADD COLUMN IF NOT EXISTS sub_tier                 text,
  ADD COLUMN IF NOT EXISTS sub_current_period_end   timestamptz,
  ADD COLUMN IF NOT EXISTS sub_cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- Stripe does not guarantee webhook ordering. Without a watermark a stale
  -- customer.subscription.updated arriving after .deleted would un-cancel a
  -- cancelled subscription. Stores event.created of the last applied sub event.
  ADD COLUMN IF NOT EXISTS sub_event_at             timestamptz,
  ADD COLUMN IF NOT EXISTS billing_mode             text NOT NULL DEFAULT 'none';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_billing_mode_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_billing_mode_check
  CHECK (billing_mode IN ('none','pass','subscription','both'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pass_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pass_tier_check
  CHECK (pass_tier IS NULL OR pass_tier IN ('retail','portfolio','desk','private','institutional'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sub_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sub_tier_check
  CHECK (sub_tier IS NULL OR sub_tier IN ('retail','portfolio','desk','private','institutional'));

CREATE INDEX IF NOT EXISTS profiles_sub_id_idx ON public.profiles(stripe_subscription_id);

-- Webhook replay kill-switch. Insert-first; a PK conflict means this event was
-- already processed, so the handler short-circuits. Covers EVERY event type,
-- which last_stripe_session_id never did (it only guarded
-- checkout.session.completed). Keep both: belt and braces, and the old guard
-- is already load-bearing.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id          text PRIMARY KEY,   -- Stripe event id, evt_...
  type        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only, same posture as purchases/events.

-- purchases is a historical ledger. It will hold ladder values going forward
-- and legacy values for old rows; normalizeTier() in lib/access.ts reads both.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS kind text; -- 'pass' | 'subscription_cycle'
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_invoice_id_key
  ON public.purchases(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
-- Subscription cycles arrive as invoices and have no checkout session id.
ALTER TABLE public.purchases ALTER COLUMN stripe_session_id DROP NOT NULL;

COMMIT;


-- ===========================================================================
-- STEP 3b -- RUN THIS AS ITS OWN SEPARATE PASTE, after the above commits.
-- (Separate because a $$ quoting error would otherwise roll back the DDL.)
-- ===========================================================================
-- The single reconciliation rule. Webhook handlers write ONE slot and then call
-- this; they never compute a tier or an expiry themselves.

CREATE OR REPLACE FUNCTION public.recompute_entitlement(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r        public.profiles%ROWTYPE;
  ladder   text[] := ARRAY['retail','portfolio','desk','private','institutional'];
  -- Subscriptions renew ON the period end. The invoice webhook can lag by
  -- minutes, and Stripe smart-retries a failed charge for days. Three days of
  -- slack beats locking a paying member out of what they just renewed.
  -- customer.subscription.deleted revokes immediately regardless of this, so
  -- the grace can only ever cover genuine dunning.
  grace    interval := interval '3 days';
  pass_ok  boolean;
  sub_ok   boolean;
  eff_tier text := 'retail';
  eff_exp  timestamptz;
  mode     text := 'none';
BEGIN
  SELECT * INTO r FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  pass_ok := r.pass_tier IS NOT NULL
         AND r.pass_expires_at IS NOT NULL
         AND r.pass_expires_at > now();

  sub_ok := r.sub_tier IS NOT NULL
        AND r.subscription_status IN ('active','trialing','past_due')
        AND r.sub_current_period_end IS NOT NULL
        AND now() < r.sub_current_period_end + grace;

  IF pass_ok THEN
    eff_tier := r.pass_tier;
    eff_exp  := r.pass_expires_at;
    mode     := 'pass';
  END IF;

  IF sub_ok THEN
    IF NOT pass_ok
       OR array_position(ladder, r.sub_tier) > array_position(ladder, eff_tier) THEN
      eff_tier := r.sub_tier;
    END IF;
    eff_exp := GREATEST(COALESCE(eff_exp, 'epoch'::timestamptz),
                        r.sub_current_period_end + grace);
    mode := CASE WHEN pass_ok THEN 'both' ELSE 'subscription' END;
  END IF;

  IF NOT pass_ok AND NOT sub_ok THEN
    -- Preserve the lapsed-vs-never-paid distinction resolveAccess relies on:
    -- keep the last held tier and its past expiry so membership reads
    -- 'expired' rather than 'free', which drives the Renew copy everywhere.
    eff_tier := COALESCE(NULLIF(r.subscription_tier, 'retail'), 'retail');
    eff_exp  := GREATEST(COALESCE(r.pass_expires_at, 'epoch'::timestamptz),
                         COALESCE(r.sub_current_period_end, 'epoch'::timestamptz));
    IF eff_exp = 'epoch'::timestamptz THEN eff_exp := NULL; END IF;
  END IF;

  UPDATE public.profiles
  SET subscription_tier = eff_tier,
      access_expires_at = eff_exp,
      billing_mode      = mode
  WHERE id = p_user;
END $$;

-- The ladder array above duplicates TIER_RANK in lib/access.ts. That is the
-- price of enforcing the rule once, in the database. Change both together.

REVOKE ALL ON FUNCTION public.recompute_entitlement(uuid) FROM anon, authenticated;
