-- Run this against your Supabase project to add the todays_bets table

CREATE TABLE IF NOT EXISTS todays_bets (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date            TEXT,
  sport           TEXT,
  risk            TEXT,
  bet             TEXT,
  line            TEXT,
  win             TEXT,
  result          TEXT        DEFAULT 'pending',
  note            TEXT,
  is_active       BOOLEAN     DEFAULT true,
  is_free         BOOLEAN     DEFAULT true,
  show_on_results BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE todays_bets ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public on home page and results page)
CREATE POLICY "Public read todays_bets"
  ON todays_bets FOR SELECT USING (true);

-- Only service role (admin API) can write — enforced at the route level
