-- PASTE 1 of 3. Run this whole file as one paste in the Supabase SQL editor.
-- Creates the per-member quota table. ai_usage_anon and ai_threads already exist.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day        date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  messages   integer NOT NULL DEFAULT 0,
  tokens_in  bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ai_usage_day_idx ON public.ai_usage(day);
