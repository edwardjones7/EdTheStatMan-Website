-- ===========================================================================
-- Discord role sync: link a member to their Discord account.
-- Independent of every other migration; run any time.
-- ===========================================================================
-- WHY A COLUMN AND NOT A THIRD-PARTY INTEGRATION.
--
-- Every off-the-shelf Stripe/Discord tool (Launchpass, Whop, Upgrade.chat)
-- decides who is a member from an ACTIVE STRIPE SUBSCRIPTION. Checked against
-- production 2026-09-05: not one paying member has a subscription -- every one
-- is billing_mode='pass', a one-time payment, stripe_subscription_id NULL,
-- because the season pass is deliberately never recurring. Those tools would
-- grant the role to nobody.
--
-- The source of truth is profiles.access_expires_at, maintained by
-- recompute_entitlement() over both billing slots. So the sync reads Supabase,
-- not Stripe.
--
-- NULL means "has not connected Discord". It is not an error state: a member
-- can pay and never link an account, and nothing can assign them a role until
-- they do -- there is no way to discover someone's Discord id from their email.
-- ===========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id text;

-- One Discord account per profile, and one profile per Discord account: without
-- this, two members could link the same Discord user and a lapse on either would
-- strip a role the other still pays for. Partial, because most rows are NULL and
-- NULLs must stay non-unique.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_discord_user_id_key
  ON public.profiles(discord_user_id)
  WHERE discord_user_id IS NOT NULL;

-- The sweep queries "everyone who has linked", so index that predicate too.
CREATE INDEX IF NOT EXISTS profiles_discord_linked_idx
  ON public.profiles(access_expires_at)
  WHERE discord_user_id IS NOT NULL;

-- VERIFY
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='profiles' AND column_name='discord_user_id';
--   SELECT indexname FROM pg_indexes
--    WHERE tablename='profiles' AND indexname LIKE 'profiles_discord%';
