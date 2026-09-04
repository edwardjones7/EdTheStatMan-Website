-- PASTE 3 of 3. Run this whole file as one paste, after file 2 commits.
-- Anonymous quota + token accounting + the manual pruner.
-- The ai_usage_anon table it uses already exists.

CREATE OR REPLACE FUNCTION public.consume_ai_quota_anon(p_ip text, p_limit integer)
RETURNS TABLE(allowed boolean, used integer, remaining integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_day  date := (now() AT TIME ZONE 'America/New_York')::date;
  v_used integer;
BEGIN
  INSERT INTO public.ai_usage_anon AS u (ip_hash, day, messages)
  VALUES (p_ip, v_day, 1)
  ON CONFLICT (ip_hash, day) DO UPDATE
    SET messages = u.messages + 1, updated_at = now()
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
