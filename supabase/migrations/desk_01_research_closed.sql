-- Close the research on a game once it has been played.
--
-- WHY. The Desk's defining rule is that curated Vault rows are readable IN THE
-- CONTEXT of a matchup by Research Desk members, even though the browsable
-- library is Private. That is the product: we did the work of picking which
-- systems and trends apply to this game, and you get to read them.
--
-- It is also a leak, in aggregate. Every played game keeps its links forever, so
-- a Desk member who walks back through the season's archive reads the Private
-- library one matchup at a time and never needs to buy it. The value of the
-- curation is the curation; the value of the LIBRARY is that you cannot get it
-- this way.
--
-- So: research on a game is open while the game is ahead of you and can be shut
-- afterwards. `research_closed_at` is the moment it was shut. NULL means open,
-- which is what every existing row is and what every new one starts as -- this
-- migration changes nothing that is currently visible.
--
-- A TIMESTAMP, NOT A BOOLEAN. "Closed" and "closed on the 14th" cost the same
-- to store, and the second one answers questions the first cannot: when did we
-- shut this, did we shut the whole week together, was it before or after the
-- member who complained lost access.
--
-- WHO IS AFFECTED. Only the Desk rung's in-context view. Private and
-- Institutional members hold the library itself, so closing a game takes
-- nothing from them, and admins always see everything. A Desk member on a
-- closed game sees what a free reader sees: record-only teasers saying research
-- exists, without saying what it is.
--
-- SAFE TO RUN BEFORE THE CODE DEPLOY: it only adds a nullable column. The page
-- reads nfl_games with select('*'), so until this lands the field is simply
-- undefined and every game reads as open.

ALTER TABLE public.nfl_games
  ADD COLUMN IF NOT EXISTS research_closed_at timestamptz;

COMMENT ON COLUMN public.nfl_games.research_closed_at IS
  'When the curated systems/trends stopped being readable by the Research Desk rung in this game''s context. NULL = open. Private and above are unaffected.';

-- The Desk board and the game page both ask "is this closed" per row, never
-- "which rows are closed", so this index earns its keep only on the admin-side
-- question of what is still open in a season. Partial, so it stays small --
-- and it is NOT a unique index, which is the shape that has bitten this project
-- before (see docs/MIGRATIONS.md).
CREATE INDEX IF NOT EXISTS nfl_games_research_open_idx
  ON public.nfl_games (sport, season, season_type, week)
  WHERE research_closed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Verify (expect: the column exists, and every existing game is still open)
-- ---------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE research_closed_at IS NULL) AS open,
--          count(*) FILTER (WHERE research_closed_at IS NOT NULL) AS closed,
--          count(*) AS total
--   FROM public.nfl_games;
--
-- Closing a whole week by hand, if you ever want to catch up at once:
--   UPDATE public.nfl_games SET research_closed_at = now()
--   WHERE sport = 'cfb' AND season = 2026 AND season_type = 2 AND week = 1
--     AND research_closed_at IS NULL;
