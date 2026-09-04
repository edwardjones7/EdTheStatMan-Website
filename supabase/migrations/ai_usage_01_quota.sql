-- ===========================================================================
-- EDTHESTATBOT -- DAILY QUOTA
-- ===========================================================================
-- Independent of the tier_ladder steps. Can be applied any time, before or
-- after them. Apply by hand in the Supabase SQL editor like everything else in
-- this directory; there is no migration runner.
--
-- WHY THIS EXISTS: /api/statbot calls a frontier model on every message and
-- had no cap of any kind. A signed-in retail (free) member could loop it. This
-- is the only cost ceiling on the whole endpoint.
--
-- WHY THE COUNTER LIVES IN POSTGRES: there is no Redis or KV in this project,
-- and adding one for a counter would be the most expensive dependency in the
-- stack. Supabase is already on the request path for the entitlement check, so
-- the quota costs one extra round trip and no new infrastructure.
--
-- WHY ONE STATEMENT: consume_ai_quota() increments and tests the limit in a
-- single INSERT ... ON CONFLICT. A read-then-write would let two concurrent
-- requests both observe messages = limit - 1 and both pass. Streaming responses
-- are long-lived, so concurrent requests from one user are the normal case, not
-- the edge case.
-- ===========================================================================

BEGIN;

-- The day key is the New York date, matching toNYDate()/nyMidnightUTC() in
-- lib/analytics.ts and the bucket boundaries in lib/admin-analytics.ts. A UTC
-- day would roll the quota over at 7 or 8pm local, mid-slate.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day        date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  messages   integer NOT NULL DEFAULT 0,
  -- Recorded for cost attribution, not enforced against. The message count is
  -- the ceiling; tokens tell us what a rung actually costs to serve.
  tokens_in  bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- No policies, on purpose: service-role only, the same posture as purchases,
-- events and stripe_events. Nothing in the browser reads this.

CREATE INDEX IF NOT EXISTS ai_usage_day_idx ON public.ai_usage(day);

COMMIT;


-- ===========================================================================
-- RUN THIS AS ITS OWN SEPARATE PASTE, after the above commits.
-- (Separate because a $$ quoting error would otherwise roll back the DDL.)
-- ===========================================================================
-- Atomically claim one message against today's allowance.
--
-- Returns allowed=false WITHOUT incrementing when the caller is already at the
-- limit. The WHERE clause on the DO UPDATE is what makes that atomic: if it
-- fails the row is not updated and RETURNING yields nothing, which the
-- NOT FOUND branch turns into a refusal carrying the true current count.

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user uuid, p_limit integer)
RETURNS TABLE(allowed boolean, used integer, remaining integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_day  date := (now() AT TIME ZONE 'America/New_York')::date;
  v_used integer;
BEGIN
  -- The target is ALIASED as `u`. Inside ON CONFLICT DO UPDATE and RETURNING
  -- the insert target is only in scope under its unqualified name, so writing
  -- `public.ai_usage.messages` there fails to resolve; Postgres then reports the
  -- next token instead, as `relation "v_used" does not exist`, which points at
  -- the wrong line entirely. `INSERT INTO ... AS u` is the documented fix.
  INSERT INTO public.ai_usage AS u (user_id, day, messages)
  VALUES (p_user, v_day, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET messages = u.messages + 1,
        updated_at = now()
    WHERE u.messages < p_limit
  RETURNING u.messages INTO v_used;

  IF NOT FOUND THEN
    -- At the limit. Report the real count without touching it.
    SELECT u.messages INTO v_used
    FROM public.ai_usage u
    WHERE u.user_id = p_user AND u.day = v_day;

    RETURN QUERY SELECT false, COALESCE(v_used, p_limit), 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, GREATEST(p_limit - v_used, 0);
END $$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, integer) FROM anon, authenticated;


-- Token accounting, written after a response finishes. Deliberately separate
-- from the quota claim: the claim must be cheap and happen before the model
-- call, while token counts only exist afterwards, and a failed stream should
-- still have consumed its message.
CREATE OR REPLACE FUNCTION public.record_ai_tokens(p_user uuid, p_in bigint, p_out bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  UPDATE public.ai_usage
  SET tokens_in = tokens_in + COALESCE(p_in, 0),
      tokens_out = tokens_out + COALESCE(p_out, 0),
      updated_at = now()
  WHERE user_id = p_user AND day = v_day;
END $$;

REVOKE ALL ON FUNCTION public.record_ai_tokens(uuid, bigint, bigint) FROM anon, authenticated;

-- VERIFY:
--   SELECT * FROM public.consume_ai_quota('<a user id>'::uuid, 3);  -- run 4x
--   -- expect allowed=true,used=1..3 then allowed=false,used=3,remaining=0
--   SELECT * FROM public.ai_usage WHERE user_id = '<a user id>';
--   DELETE FROM public.ai_usage WHERE user_id = '<a user id>';      -- reset
