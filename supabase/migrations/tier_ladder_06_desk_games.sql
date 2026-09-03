-- ===========================================================================
-- v3 RESEARCH DESK -- STEP 6. Independent of steps 1-5; can be applied any time.
-- ===========================================================================
-- Prepares nfl_games to back a sport-agnostic, schedule-driven Research Desk.
--
-- THE TABLE IS NOT RENAMED. `games` would read better, but nfl_games is
-- referenced by the admin sync, both NFL pages, the curated join tables and
-- lib/nfl.ts, and renaming it would make the code deploy and the SQL strictly
-- simultaneous. A `sport` column plus /desk/[sport]/... routing buys the
-- sport-agnosticism without that coupling. The rename is a later, optional
-- tidy-up once nothing reads the old name.
--
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS or drop-then-add.
--
-- All new columns are NULLABLE and the app reads them defensively, so the
-- Research Desk works before this is applied -- it simply shows no lines.
--
-- ODDS ARE FREE AND KEYLESS. cdn.espn.com/core/nfl/schedule?xhr=1 returns
-- spread, moneyline and total with BOTH open and close prices, which is why
-- there is no odds vendor here and no API key to manage.
-- ===========================================================================

BEGIN;

-- Sport key. Everything currently in the table is NFL by construction.
ALTER TABLE public.nfl_games ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'nfl';

ALTER TABLE public.nfl_games DROP CONSTRAINT IF EXISTS nfl_games_sport_check;
ALTER TABLE public.nfl_games ADD CONSTRAINT nfl_games_sport_check
  CHECK (sport IN ('nfl','nflpre','cfb','cfl','nba','wnba','cbb'));

-- Lines. `open` is captured the first time we see a game and then left alone;
-- `close`/current moves with each sync. The pair is what makes line movement
-- displayable without paying anyone for it.
ALTER TABLE public.nfl_games
  ADD COLUMN IF NOT EXISTS spread_open        numeric,
  ADD COLUMN IF NOT EXISTS spread_current     numeric,
  ADD COLUMN IF NOT EXISTS spread_favorite    text,     -- team abbrev, e.g. 'SEA'
  ADD COLUMN IF NOT EXISTS total_open         numeric,
  ADD COLUMN IF NOT EXISTS total_current      numeric,
  ADD COLUMN IF NOT EXISTS ml_home_open       integer,
  ADD COLUMN IF NOT EXISTS ml_home_current    integer,
  ADD COLUMN IF NOT EXISTS ml_away_open       integer,
  ADD COLUMN IF NOT EXISTS ml_away_current    integer,
  ADD COLUMN IF NOT EXISTS odds_provider      text,     -- e.g. 'DraftKings'
  ADD COLUMN IF NOT EXISTS odds_updated_at    timestamptz;

-- Context that makes a schedule row read like a real desk entry.
ALTER TABLE public.nfl_games
  ADD COLUMN IF NOT EXISTS venue_name    text,
  ADD COLUMN IF NOT EXISTS venue_city    text,
  ADD COLUMN IF NOT EXISTS venue_state   text,
  ADD COLUMN IF NOT EXISTS venue_indoor  boolean,
  ADD COLUMN IF NOT EXISTS broadcast     text,          -- e.g. 'NBC'
  ADD COLUMN IF NOT EXISTS home_record   text,          -- e.g. '3-1'
  ADD COLUMN IF NOT EXISTS away_record   text;

-- The weekly desk note: one curated block per sport/season/week. This is the
-- editorial layer that makes the Desk a product rather than a schedule scrape.
CREATE TABLE IF NOT EXISTS public.desk_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport       text NOT NULL DEFAULT 'nfl',
  season      integer NOT NULL,
  season_type integer NOT NULL DEFAULT 2,
  week        integer NOT NULL,
  title       text NOT NULL DEFAULT '',
  body_html   text NOT NULL DEFAULT '',
  /* Which rung may read the note. The schedule itself is Desk; the note is the
     part worth paying for, so it defaults to the same rung. */
  min_tier    text NOT NULL DEFAULT 'desk',
  is_published boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sport, season, season_type, week)
);

ALTER TABLE public.desk_notes DROP CONSTRAINT IF EXISTS desk_notes_min_tier_check;
ALTER TABLE public.desk_notes ADD CONSTRAINT desk_notes_min_tier_check
  CHECK (min_tier IN ('retail','portfolio','desk','private','institutional'));

-- RLS on with NO select policy, matching nfl_games: every read goes through a
-- server component using the service-role client and is redacted there.
ALTER TABLE public.desk_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS nfl_games_sport_season_week_idx
  ON public.nfl_games(sport, season, season_type, week);

COMMIT;

-- VERIFY:
--   SELECT sport, count(*) FROM public.nfl_games GROUP BY 1;
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nfl_games' AND column_name LIKE 'spread%';
