-- ===========================================================================
-- EDTHESTATBOT -- ANONYMOUS QUOTA + CONVERSATION PERSISTENCE
-- ===========================================================================
-- Apply AFTER ai_usage_01_quota.sql. Independent of the tier_ladder_* steps.
-- Apply by hand in the Supabase SQL editor; there is no migration runner.
--
-- TWO THINGS, one file, because they arrived together:
--
--   1. ai_usage_anon -- EdTheStatBot is now mounted for signed-out visitors on
--      every page. Those callers have no profiles row, so they cannot be
--      counted in ai_usage (whose user_id is a FK to profiles). They get their
--      own table keyed by a salted hash of the caller IP.
--
--   2. ai_threads -- the panel used to reset on every hard reload. One rolling
--      thread per member, stored server-side.
--
-- WHY A HASH AND NOT THE IP: this is an abuse ceiling, not analytics. We never
-- need to read an IP back, only to recognise a repeat caller within a day, so
-- storing the raw address would be collecting a personal identifier for no
-- operational gain. See hashCaller() in lib/ai/quota.ts.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Anonymous quota
-- ---------------------------------------------------------------------------
-- Same shape as ai_usage so the two read identically in a cost query, minus the
-- FK. `day` is the New York date for the same reason: a UTC day rolls over
-- mid-slate at 7 or 8pm local.
CREATE TABLE IF NOT EXISTS public.ai_usage_anon (
  ip_hash    text NOT NULL,
  day        date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  messages   integer NOT NULL DEFAULT 0,
  tokens_in  bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, day)
);

ALTER TABLE public.ai_usage_anon ENABLE ROW LEVEL SECURITY;
-- No policies, on purpose: service-role only, matching ai_usage.

CREATE INDEX IF NOT EXISTS ai_usage_anon_day_idx ON public.ai_usage_anon(day);

-- ---------------------------------------------------------------------------
-- 2. Conversation persistence
-- ---------------------------------------------------------------------------
-- ONE rolling thread per member, not a thread list. The bot is a floating panel
-- in the corner of every page, not a chat product: the thing people actually
-- want is for it to still be there after a reload. A thread list would need its
-- own UI -- switcher, titles, deletion -- for a surface that is 380px wide.
--
-- `messages` holds AI SDK UIMessage[] verbatim so it round-trips into useChat
-- with no translation layer. Trimmed to the last N turns on write by
-- saveThread() in lib/ai/thread.ts; nothing here enforces a size, so if that
-- cap is ever removed this column grows without bound.
CREATE TABLE IF NOT EXISTS public.ai_threads (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
-- Service-role only. The thread is written by /api/statbot after a response
-- finishes and read by StatBotMount on the server; the browser never touches
-- this table directly, so there is no policy to write.

CREATE INDEX IF NOT EXISTS ai_threads_updated_idx ON public.ai_threads(updated_at);

COMMIT;


-- ===========================================================================
-- RUN THIS AS ITS OWN SEPARATE PASTE, after the above commits.
-- (Separate because a $$ quoting error would otherwise roll back the DDL.)
-- ===========================================================================

-- Anonymous twin of consume_ai_quota(). Identical atomicity argument: the
-- WHERE on the DO UPDATE is what stops two concurrent streams from both
-- observing messages = limit - 1 and both passing.
CREATE OR REPLACE FUNCTION public.consume_ai_quota_anon(p_ip text, p_limit integer)
RETURNS TABLE(allowed boolean, used integer, remaining integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_day  date := (now() AT TIME ZONE 'America/New_York')::date;
  v_used integer;
BEGIN
  -- The target is ALIASED as `u`. Inside ON CONFLICT DO UPDATE and RETURNING
  -- the insert target is only in scope under its unqualified name, so writing
  -- `public.ai_usage_anon.messages` there fails to resolve; Postgres then reports the
  -- next token instead, as `relation "v_used" does not exist`, which points at
  -- the wrong line entirely. `INSERT INTO ... AS u` is the documented fix.
  INSERT INTO public.ai_usage_anon AS u (ip_hash, day, messages)
  VALUES (p_ip, v_day, 1)
  ON CONFLICT (ip_hash, day) DO UPDATE
    SET messages = u.messages + 1,
        updated_at = now()
    WHERE u.messages < p_limit
  RETURNING u.messages INTO v_used;

  IF NOT FOUND THEN
    SELECT u.messages INTO v_used
    FROM public.ai_usage_anon u
    WHERE u.ip_hash = p_ip AND u.day = v_day;

    RETURN QUERY SELECT false, COALESCE(v_used, p_limit), 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, GREATEST(p_limit - v_used, 0);
END $$;

REVOKE ALL ON FUNCTION public.consume_ai_quota_anon(text, integer) FROM anon, authenticated;


CREATE OR REPLACE FUNCTION public.record_ai_tokens_anon(p_ip text, p_in bigint, p_out bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  UPDATE public.ai_usage_anon
  SET tokens_in = tokens_in + COALESCE(p_in, 0),
      tokens_out = tokens_out + COALESCE(p_out, 0),
      updated_at = now()
  WHERE ip_hash = p_ip AND day = v_day;
END $$;

REVOKE ALL ON FUNCTION public.record_ai_tokens_anon(text, bigint, bigint) FROM anon, authenticated;


-- Anonymous rows are an abuse counter with no analytical value past the day
-- they cover, and they are keyed by a hashed identifier we cannot answer a
-- deletion request against. Drop them on a schedule rather than accumulating
-- them forever. Called by nothing automatically -- run it from the SQL editor,
-- or attach it to pg_cron if that is ever enabled on this project.
CREATE OR REPLACE FUNCTION public.prune_ai_usage_anon(p_keep_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.ai_usage_anon
  WHERE day < ((now() AT TIME ZONE 'America/New_York')::date - p_keep_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.prune_ai_usage_anon(integer) FROM anon, authenticated;

-- VERIFY:
--   SELECT * FROM public.consume_ai_quota_anon('test-hash', 2);  -- run 3x
--   -- expect allowed=true,used=1 / true,2 / false,2,remaining=0
--   DELETE FROM public.ai_usage_anon WHERE ip_hash = 'test-hash';
--   SELECT to_regclass('public.ai_threads');                     -- expect ai_threads
