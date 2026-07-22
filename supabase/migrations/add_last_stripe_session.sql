-- Webhook idempotency guard.
--
-- The checkout webhook now EXTENDS access_expires_at instead of overwriting it,
-- so a Stripe retry (which happens on any non-2xx or timeout) would grant a
-- second 30/365 days for free. Storing the last processed session id lets the
-- handler short-circuit duplicates.
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the webhook change,
-- otherwise the handler's select errors and no access is granted.

alter table public.profiles
  add column if not exists last_stripe_session_id text;
