-- ===========================================================================
-- v3 TIER LADDER -- STEP 7. Independent of 1-6; run any time, any order.
-- ===========================================================================
-- FIXES A SILENT REVENUE-LEDGER FAILURE.
--
-- tier_ladder_03 created the invoice key as a PARTIAL unique index:
--
--   CREATE UNIQUE INDEX purchases_stripe_invoice_id_key
--     ON public.purchases(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
--
-- Postgres will not infer a partial index for `ON CONFLICT (stripe_invoice_id)`
-- unless the statement repeats the index predicate, and PostgREST -- which is
-- what supabase-js speaks -- never emits it. So every upsert onto that key died
-- with:
--
--   42P10  there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- That is the ONLY write path for subscription revenue. `invoice.payment_succeeded`
-- is what records a monthly cycle, and every one of them failed. Nothing
-- surfaced it, because recordPurchase() ignored the returned error (fixed in
-- the same commit as this file). Effect: profiles and entitlement were correct,
-- the member had the access they paid for, and `purchases` -- the table
-- getGlobalTotals() sums for all-time revenue -- silently missed every
-- recurring payment. The failure mode is under-reported income, not lost access,
-- which is exactly the kind that survives a demo.
--
-- Found 2026-09-05 by a test-mode Desk subscription that granted correctly and
-- wrote no ledger row.
--
-- THE PREDICATE WAS NEVER NEEDED. A plain unique index already permits many
-- NULLs -- Postgres treats NULLs as distinct for uniqueness -- so one-time
-- purchases, which carry no invoice id, are unaffected either way.
-- ===========================================================================

BEGIN;

DROP INDEX IF EXISTS public.purchases_stripe_invoice_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_invoice_id_key
  ON public.purchases(stripe_invoice_id);

COMMIT;

-- VERIFY. Expect one row, and `indexdef` must NOT contain a WHERE clause.
--
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname='public' AND indexname='purchases_stripe_invoice_id_key';
--
-- Then prove the upsert path itself, which is what actually broke:
--
--   INSERT INTO public.purchases (user_id, stripe_invoice_id, tier, kind,
--                                 amount_cents, currency)
--   VALUES ('<any real user id>', 'in_probe_delete_me', 'desk',
--           'subscription_cycle', 12900, 'usd')
--   ON CONFLICT (stripe_invoice_id) DO NOTHING;
--   DELETE FROM public.purchases WHERE stripe_invoice_id = 'in_probe_delete_me';
--
-- BACKFILL. Cycles billed while this was broken are absent from the ledger and
-- recoverable from Stripe -- scripts/sync-stripe-webhook-events.mjs is the
-- pattern. Nothing to backfill as of 2026-09-05: no live subscription had ever
-- been created, because the eight prices did not exist yet.
