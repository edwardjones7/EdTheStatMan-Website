-- Lifecycle email: the once-only guard.
--
-- One row per (member, kind of email, reference). The cron and the Stripe
-- webhook INSERT here before they send, and the unique constraint is what turns
-- a daily cron, a retried run or two overlapping runs into exactly one email.
--
--   kind  'pass_expiring_7d' | 'pass_expiring_1d' | 'pass_expired' | 'payment_failed'
--   ref   for pass mail: the pass_expires_at DATE (YYYY-MM-DD) the email is about,
--         so a member who renews gets a fresh set of reminders for the new date
--         instead of being silenced by the old one.
--         for payment_failed: the Stripe invoice id, so each failed invoice gets
--         one email however many times Stripe retries it.
--
-- Service role only. RLS on with NO policies: a member has no reason to read
-- or write this, and anon must not be able to forge "already sent" rows.
--
-- Safe to deploy the code before this: the cron probes for the table and
-- no-ops without it, and the webhook falls back to first-attempt-only.
-- Apply by hand in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.email_log (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind     text        NOT NULL,
  ref      text        NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  -- A plain (not partial) unique constraint, on purpose: PostgREST's
  -- ON CONFLICT cannot target a partial index (42P10), which is how the
  -- purchases ledger silently lost every subscription row.
  CONSTRAINT email_log_once UNIQUE (user_id, kind, ref)
);

CREATE INDEX IF NOT EXISTS email_log_sent_at_idx ON public.email_log (sent_at);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role access only.
