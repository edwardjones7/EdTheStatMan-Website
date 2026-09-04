-- PASTE 2 of 3. Run this whole file as one paste, after file 1 commits.
-- Per-member quota claim + token accounting.

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user uuid, p_limit integer)
RETURNS TABLE(allowed boolean, used integer, remaining integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_day  date := (now() AT TIME ZONE 'America/New_York')::date;
  v_used integer;
BEGIN
  INSERT INTO public.ai_usage AS u (user_id, day, messages)
  VALUES (p_user, v_day, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET messages = u.messages + 1, updated_at = now()
    WHERE u.messages < p_limit
  RETURNING u.messages INTO v_used;

  IF NOT FOUND THEN
    SELECT u.messages INTO v_used
    FROM public.ai_usage u
    WHERE u.user_id = p_user AND u.day = v_day;
    RETURN QUERY SELECT false, COALESCE(v_used, p_limit), 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, GREATEST(p_limit - v_used, 0);
END $$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, integer) FROM anon, authenticated;


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
