-- Vault step 1 of 2: give every system and every trend a human-readable key.
--
-- WHY. The Vault has always been sorted by whatever the row happened to look
-- like -- sample size for systems, team name for trends -- which means the
-- order changes under you as records update, and there is no stable handle to
-- say "fix CFBS0007" by. `id` is a uuid: correct for joins, useless to type.
-- `code` is the business key: typed by hand, unique, and sorted as text, which
-- is why it is zero padded. CFBS0001 < CFBS0002 < ... < CFBS0010 as a string.
--
-- SHAPE. `id uuid` stays the primary key. nfl_game_systems.system_id and
-- nfl_game_trends.trend_id are uuid foreign keys onto it, and repointing them
-- at a hand-typed column would put a curated matchup one typo away from
-- losing its rows. `code` is a UNIQUE alternate key, nothing more.
--
-- NULLABLE ON PURPOSE. The backfill below gives every existing row a code, but
-- the column stays nullable so an import of a sheet without an ID column still
-- lands. A unique index treats NULLs as distinct, so any number of uncoded
-- rows can coexist; the moment two rows carry the SAME code the insert fails,
-- which is the whole point.
--
-- SAFE TO RUN BEFORE THE CODE DEPLOY: it only adds. The drops are step 2.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------

ALTER TABLE public.betting_systems ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.betting_trends  ADD COLUMN IF NOT EXISTS code text;

-- ---------------------------------------------------------------------------
-- 2. Backfill, per sport, in the order the rows were created
--
-- Only rows that have no code yet, so this file is safe to re-run and will
-- never renumber a row someone has already labelled by hand. The prefix table
-- is duplicated in components/SportTabsSystem.tsx (SPORT_CODE) -- if a sport is
-- ever added, both need it, or the app will suggest a code this file would not
-- have produced.
-- ---------------------------------------------------------------------------

WITH numbered AS (
  SELECT
    id,
    CASE sport
      WHEN 'nfl' THEN 'NFL' WHEN 'nflpre' THEN 'NFLP' WHEN 'cfl' THEN 'CFL'
      WHEN 'cfb' THEN 'CFB' WHEN 'nba' THEN 'NBA'    WHEN 'wnba' THEN 'WNBA'
      WHEN 'cbb' THEN 'CBB' ELSE upper(sport)
    END AS prefix,
    row_number() OVER (PARTITION BY sport ORDER BY created_at, id) AS n
  FROM public.betting_systems
  WHERE code IS NULL
)
UPDATE public.betting_systems s
SET code = numbered.prefix || 'S' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE s.id = numbered.id;

WITH numbered AS (
  SELECT
    id,
    CASE sport
      WHEN 'nfl' THEN 'NFL' WHEN 'nflpre' THEN 'NFLP' WHEN 'cfl' THEN 'CFL'
      WHEN 'cfb' THEN 'CFB' WHEN 'nba' THEN 'NBA'    WHEN 'wnba' THEN 'WNBA'
      WHEN 'cbb' THEN 'CBB' ELSE upper(sport)
    END AS prefix,
    row_number() OVER (PARTITION BY sport ORDER BY created_at, id) AS n
  FROM public.betting_trends
  WHERE code IS NULL
)
UPDATE public.betting_trends t
SET code = numbered.prefix || 'T' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE t.id = numbered.id;

-- ---------------------------------------------------------------------------
-- 3. Uniqueness and sort support
--
-- On upper(code), so CFBS0001 and cfbs0001 cannot both exist -- the codes are
-- typed by hand into a spreadsheet and case is not a distinction anyone means.
-- NOT a partial index: PostgREST cannot use one for ON CONFLICT (42P10), and a
-- partial unique index on this project has already cost us a full ledger of
-- writes once. See the note in docs/MIGRATIONS.md.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS betting_systems_code_key
  ON public.betting_systems (upper(code));
CREATE UNIQUE INDEX IF NOT EXISTS betting_trends_code_key
  ON public.betting_trends (upper(code));

-- The Vault's default order is code ascending within a sport.
CREATE INDEX IF NOT EXISTS betting_systems_sport_code_idx
  ON public.betting_systems (sport, code);
CREATE INDEX IF NOT EXISTS betting_trends_sport_code_idx
  ON public.betting_trends (sport, code);

-- ---------------------------------------------------------------------------
-- Verify (expect: 0 uncoded rows, and no duplicates)
-- ---------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE code IS NULL) AS uncoded, count(*) AS total
--   FROM public.betting_systems;
--
--   SELECT sport, min(code), max(code), count(*)
--   FROM public.betting_systems GROUP BY 1 ORDER BY 1;
--
--   SELECT upper(code), count(*) FROM public.betting_systems
--   GROUP BY 1 HAVING count(*) > 1;
