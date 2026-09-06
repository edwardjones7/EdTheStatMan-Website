-- Vault step 2 of 2: drop the columns the Research Desk replaced.
--
-- DESTRUCTIVE, AND ONLY AFTER THE CODE THAT STOPPED WRITING THEM IS DEPLOYED.
-- Reads are safe either way (every query is select('*')), but the admin editors
-- and both XLSX importers POST a whole form object, so an old bundle still open
-- in a browser tab would send `line` at a table that no longer has it and get
-- PGRST204 back. Deploy first, then run this, then hard-refresh the admin page.
--
-- WHAT GOES, AND WHY
--
--   line   Which market the rule is on (ATS, O/U, ML). Free text, never
--          filtered on, and the Desk now carries the actual line -- opening
--          and current, spread, total and moneyline -- per game.
--   type   "Situational" / "Trend". Free text, never filtered on, and the
--          table a row lives in already says which it is.
--   date   A text date, never parsed, only ever used as the third tiebreak in
--          a sort that is now `code`. The Desk holds real kickoff timestamps.
--   units  A units figure nobody kept current. Record and win % are the proof
--          the Vault sells; a stale units column undermines both.
--   team   SYSTEMS ONLY. A system is a rule, not a team; the column was blank
--          on almost every row. betting_trends KEEPS team -- that surface is
--          "team trends" and groups by it.
--
-- There is no backup step here on purpose: nothing reads these columns after
-- the deploy, and Supabase's own PITR is the restore path if a value is wanted
-- back. If you want them anyway, run this first and save the result somewhere
-- outside the database:
--
--   SELECT id, code, sport, line, type, date, team, units
--   FROM public.betting_systems ORDER BY code;
--   SELECT id, code, sport, line, type, date, units
--   FROM public.betting_trends ORDER BY code;

ALTER TABLE public.betting_systems
  DROP COLUMN IF EXISTS line,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS date,
  DROP COLUMN IF EXISTS team,
  DROP COLUMN IF EXISTS units;

ALTER TABLE public.betting_trends
  DROP COLUMN IF EXISTS line,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS date,
  DROP COLUMN IF EXISTS units;

-- ---------------------------------------------------------------------------
-- Verify (expect: the systems list without line/type/date/team/units, and
-- trends the same but still carrying team)
-- ---------------------------------------------------------------------------
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'betting_systems'
--   ORDER BY ordinal_position;
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'betting_trends'
--   ORDER BY ordinal_position;
