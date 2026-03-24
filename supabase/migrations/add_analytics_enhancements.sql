-- Add last active tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Richer page_views columns
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS device_type text; -- 'mobile' | 'tablet' | 'desktop'
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS country text;     -- from x-vercel-ip-country header (e.g. 'US', 'CA')
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS page_views_device_idx  ON public.page_views(device_type);
CREATE INDEX IF NOT EXISTS page_views_country_idx ON public.page_views(country);
CREATE INDEX IF NOT EXISTS page_views_user_idx    ON public.page_views(user_id);
