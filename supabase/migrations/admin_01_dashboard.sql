-- Admin dashboard v2. Safe to run more than once. The dashboard works without
-- this file: the three things it adds show "not set up yet" until it is applied.
--
--   1. job_runs             one row per daily cron run, for the Daily jobs panel
--   2. notify_email_off_at  when somebody unsubscribed, so the list has a trend
--   3. analytics_sources()  visitors per source, for the Growth source table

-- 1. job_runs -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_runs (
  id          bigserial   PRIMARY KEY,
  job         text        NOT NULL,
  status      text        NOT NULL CHECK (status IN ('ok', 'failed')),
  http_status integer,
  error       text,
  duration_ms integer,
  ran_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_runs_job_ran_idx ON public.job_runs (job, ran_at DESC);
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY; -- no policies: service-role only

-- 2. unsubscribe date ---------------------------------------------------------
-- Set by a trigger, not by the app, because two paths flip notify_email (the
-- one-click link and the account page) and a third would otherwise be missed.
-- Rows already switched off stay NULL: we do not know when they left.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_email_off_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_notify_email_off()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.notify_email IS DISTINCT FROM OLD.notify_email THEN
    NEW.notify_email_off_at := CASE WHEN NEW.notify_email THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_stamp_notify_email_off ON public.profiles;
CREATE TRIGGER profiles_stamp_notify_email_off
  BEFORE UPDATE OF notify_email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_notify_email_off();

-- 3. analytics_sources --------------------------------------------------------
-- utm_source wins over the referrer host, the same order lib/admin-people.ts
-- uses for signups and purchases, so the columns of the source table line up.
CREATE OR REPLACE FUNCTION public.analytics_sources(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (source text, views bigint, visitors bigint)
LANGUAGE sql STABLE
AS $$
  SELECT src AS source, count(*) AS views, count(DISTINCT visitor_id) AS visitors
  FROM (
    SELECT
      COALESCE(
        NULLIF(lower(trim(utm_source)), ''),
        NULLIF(regexp_replace(lower(substring(referrer FROM '//([^/]+)')), '^www\.', ''), ''),
        ''
      ) AS src,
      visitor_id
    FROM public.page_views
    WHERE created_at >= p_from AND created_at < p_to
  ) sub
  GROUP BY src
  ORDER BY count(*) DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.analytics_sources(timestamptz, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_sources(timestamptz, timestamptz) TO service_role;
