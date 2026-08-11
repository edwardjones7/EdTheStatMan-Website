-- Analytics v2 aggregation functions. Apply after add_analytics_v2.sql.
-- All are STABLE and callable only by the service role (execute revoked from
-- anon/authenticated) — the admin analytics API calls them via supabase.rpc().

-- Unique visitors, sessions (30-min gap heuristic), bounce rate, avg session length.
CREATE OR REPLACE FUNCTION public.analytics_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
WITH pv AS (
  SELECT visitor_id, created_at,
         lag(created_at) OVER (PARTITION BY visitor_id ORDER BY created_at) AS prev
  FROM public.page_views
  WHERE created_at >= p_from AND created_at < p_to AND visitor_id IS NOT NULL
), marked AS (
  SELECT visitor_id, created_at,
         CASE WHEN prev IS NULL OR created_at - prev > interval '30 minutes' THEN 1 ELSE 0 END AS is_new
  FROM pv
), numbered AS (
  SELECT visitor_id, created_at,
         sum(is_new) OVER (PARTITION BY visitor_id ORDER BY created_at) AS sess_no
  FROM marked
), per_session AS (
  SELECT visitor_id, sess_no, count(*) AS views,
         extract(epoch FROM max(created_at) - min(created_at)) AS duration_s
  FROM numbered GROUP BY 1, 2
)
SELECT jsonb_build_object(
  'unique_visitors', (SELECT count(DISTINCT visitor_id) FROM pv),
  'sessions',        (SELECT count(*) FROM per_session),
  'bounce_rate',     (SELECT coalesce(avg(CASE WHEN views = 1 THEN 1.0 ELSE 0 END), 0) FROM per_session),
  'avg_session_s',   (SELECT coalesce(avg(duration_s) FILTER (WHERE views > 1), 0) FROM per_session)
);
$$;

-- Views + unique visitors bucketed by day/week/month in New York time.
CREATE OR REPLACE FUNCTION public.analytics_timeseries(p_from timestamptz, p_to timestamptz, p_bucket text)
RETURNS TABLE (bucket date, views bigint, visitors bigint)
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc(p_bucket, created_at AT TIME ZONE 'America/New_York')::date AS bucket,
         count(*) AS views,
         count(DISTINCT visitor_id) AS visitors
  FROM public.page_views
  WHERE created_at >= p_from AND created_at < p_to
  GROUP BY 1 ORDER BY 1;
$$;

-- Top-N breakdown over one dimension: path | referrer | device | country | utm_source.
-- Referrers are normalized to their domain (strip protocol, path, leading www.).
CREATE OR REPLACE FUNCTION public.analytics_breakdown(p_from timestamptz, p_to timestamptz, p_dim text, p_limit int DEFAULT 10)
RETURNS TABLE (label text, count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT dim AS label, count(*) AS count
  FROM (
    SELECT CASE p_dim
      WHEN 'path'       THEN path
      WHEN 'referrer'   THEN regexp_replace(substring(referrer FROM '//([^/]+)'), '^www\.', '')
      WHEN 'device'     THEN device_type
      WHEN 'country'    THEN country
      WHEN 'utm_source' THEN utm_source
    END AS dim
    FROM public.page_views
    WHERE created_at >= p_from AND created_at < p_to
  ) sub
  WHERE dim IS NOT NULL AND dim <> ''
  GROUP BY dim ORDER BY count(*) DESC LIMIT p_limit;
$$;

-- Distinct visitors who viewed a given path in a window (funnel top).
CREATE OR REPLACE FUNCTION public.analytics_path_visitors(p_from timestamptz, p_to timestamptz, p_path text)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(DISTINCT visitor_id) FROM public.page_views
  WHERE created_at >= p_from AND created_at < p_to
    AND path = p_path AND visitor_id IS NOT NULL;
$$;

-- Live: distinct visitors in the last 5 minutes.
CREATE OR REPLACE FUNCTION public.active_visitors()
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(DISTINCT visitor_id) FROM public.page_views
  WHERE created_at > now() - interval '5 minutes';
$$;

REVOKE EXECUTE ON FUNCTION public.analytics_summary(timestamptz, timestamptz)            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_timeseries(timestamptz, timestamptz, text)   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_breakdown(timestamptz, timestamptz, text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_path_visitors(timestamptz, timestamptz, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.active_visitors()                                      FROM anon, authenticated;
