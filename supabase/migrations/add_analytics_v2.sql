-- Analytics v2: cookieless visitor identity, UTM attribution, revenue ledger, funnel events.
-- Apply manually in the Supabase SQL editor (run before add_analytics_functions.sql).

-- 1. page_views: visitor identity + first-page UTM params
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS visitor_id   text; -- daily-salted sha256(ip+ua), no PII stored
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_source   text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_medium   text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_campaign text;

CREATE INDEX IF NOT EXISTS page_views_visitor_created_idx ON public.page_views(visitor_id, created_at);
CREATE INDEX IF NOT EXISTS page_views_created_idx         ON public.page_views(created_at);

-- 2. purchases: revenue ledger written by the Stripe webhook (service role only)
CREATE TABLE IF NOT EXISTS public.purchases (
  id                bigserial PRIMARY KEY,
  user_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_session_id text NOT NULL UNIQUE, -- unique = idempotency against webhook retries
  price_id          text,
  tier              text NOT NULL,        -- 'basic' | 'premium'
  amount_cents      integer NOT NULL,
  currency          text NOT NULL DEFAULT 'usd',
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  referrer          text,
  landing_page      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_created_idx ON public.purchases(created_at);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY; -- no policies: service-role access only

-- 3. events: minimal funnel events (currently only 'checkout_click')
CREATE TABLE IF NOT EXISTS public.events (
  id         bigserial PRIMARY KEY,
  event_type text NOT NULL,
  path       text,
  visitor_id text,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_type_created_idx ON public.events(event_type, created_at);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY; -- no policies: service-role access only

-- 4. profiles: first-touch attribution snapshot (stamped once, on first tracked
--    request after login when localStorage attribution is present)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_source     text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_medium     text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_campaign   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_referrer text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS landing_page   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attributed_at  timestamptz;
