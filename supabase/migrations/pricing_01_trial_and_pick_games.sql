-- Nov 2026 pricing: the Research Desk free trial, and picks attached to games.
--
-- 1. profiles.desk_trial_ends_at
--      Set once, when a member starts the 7-day Research Desk trial, and never
--      cleared: it is what makes the trial one per account. No card is taken
--      and nothing is charged when it ends -- the trial writes the ordinary
--      pass slot (pass_tier = 'desk', pass_expires_at = this same instant) and
--      simply runs out. A pass whose expiry EQUALS this column is the trial;
--      the checkout guard and the webhook use that to treat a purchase made
--      during the trial as a fresh start rather than an upgrade
--      (lib/trial.ts).
--
-- 2. todays_bets.game_id
--      Which Desk game a pick is on, so a game page can show "the bets" and
--      the board can count them. Filled automatically when a pick is saved
--      (lib/picks/game-match.ts: sport + date + team name), and editable in
--      the admin pick editor. NULL means "not matched" and is normal for props
--      and anything off the Desk's four leagues. ON DELETE SET NULL: a game
--      re-synced away must never take a graded pick with it.
--
-- SAFE ORDER: either side of the code deploy.
--   - Before: nothing reads the columns until the code ships.
--   - After: the code probes for both columns and degrades. The trial button
--     is hidden and the trial route answers 503; picks save without a game and
--     game pages show no bets.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desk_trial_ends_at timestamptz;

ALTER TABLE public.todays_bets
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.nfl_games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS todays_bets_game_id_idx ON public.todays_bets(game_id);

COMMIT;
