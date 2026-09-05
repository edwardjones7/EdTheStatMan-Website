-- ===========================================================================
-- v3 TIER LADDER -- STEP 2 of 5. Run after step 1 commits.
-- ===========================================================================
-- Replaces the is_free / is_elite boolean PAIR with one ladder column. A pair
-- of booleans can express three states; the ladder has five, and the pair
-- cannot express "Desk sees this, Portfolio does not".
--
-- LADDER MAPPING, and the reasoning:
--
--   betting_systems / betting_trends  ->  'retail' if free, else 'private'
--       The full Vault library IS the Private product. is_elite collapses into
--       'private' deliberately: Institutional differentiates on DEPTH of
--       access (raw row export, query builder, API key, backtester), not on
--       row count. There is no rung above Private that simply has more rows.
--
--   todays_bets  ->  'retail' if free, 'private' if elite, else 'portfolio'
--       The picks ARE the Portfolio product ($49 / $199 season). The former
--       Edge Picks (is_elite) stay a premium subset at 'private'.
--
--   posts.access_level  ->  'retail' / 'desk'
--
-- NOTE the default asymmetry being preserved: betting_systems and
-- betting_trends default is_free=false (members-only unless flagged), while
-- todays_bets defaults is_free=true (free unless flagged). See
-- add_todays_bets.sql and app/api/admin/todays-bets/route.ts (`body.is_free ?? true`).
-- ===========================================================================

BEGIN;

ALTER TABLE public.betting_systems ADD COLUMN IF NOT EXISTS min_tier text;
ALTER TABLE public.betting_trends  ADD COLUMN IF NOT EXISTS min_tier text;
ALTER TABLE public.todays_bets     ADD COLUMN IF NOT EXISTS min_tier text;

UPDATE public.betting_systems SET min_tier = CASE
  WHEN COALESCE(is_free, false) THEN 'retail'
  ELSE 'private' END
WHERE min_tier IS NULL;

UPDATE public.betting_trends SET min_tier = CASE
  WHEN COALESCE(is_free, false) THEN 'retail'
  ELSE 'private' END
WHERE min_tier IS NULL;

UPDATE public.todays_bets SET min_tier = CASE
  WHEN COALESCE(is_elite, false) THEN 'private'
  WHEN COALESCE(is_free, true)   THEN 'retail'
  ELSE 'portfolio' END
WHERE min_tier IS NULL;

ALTER TABLE public.betting_systems ALTER COLUMN min_tier SET DEFAULT 'private';
ALTER TABLE public.betting_trends  ALTER COLUMN min_tier SET DEFAULT 'private';
ALTER TABLE public.todays_bets     ALTER COLUMN min_tier SET DEFAULT 'retail';

ALTER TABLE public.betting_systems ALTER COLUMN min_tier SET NOT NULL;
ALTER TABLE public.betting_trends  ALTER COLUMN min_tier SET NOT NULL;
ALTER TABLE public.todays_bets     ALTER COLUMN min_tier SET NOT NULL;

ALTER TABLE public.betting_systems DROP CONSTRAINT IF EXISTS betting_systems_min_tier_check;
ALTER TABLE public.betting_systems ADD CONSTRAINT betting_systems_min_tier_check
  CHECK (min_tier IN ('retail','portfolio','desk','private','institutional'));
ALTER TABLE public.betting_trends DROP CONSTRAINT IF EXISTS betting_trends_min_tier_check;
ALTER TABLE public.betting_trends ADD CONSTRAINT betting_trends_min_tier_check
  CHECK (min_tier IN ('retail','portfolio','desk','private','institutional'));
ALTER TABLE public.todays_bets DROP CONSTRAINT IF EXISTS todays_bets_min_tier_check;
ALTER TABLE public.todays_bets ADD CONSTRAINT todays_bets_min_tier_check
  CHECK (min_tier IN ('retail','portfolio','desk','private','institutional'));

CREATE INDEX IF NOT EXISTS betting_systems_min_tier_idx ON public.betting_systems(min_tier);
CREATE INDEX IF NOT EXISTS betting_trends_min_tier_idx  ON public.betting_trends(min_tier);
CREATE INDEX IF NOT EXISTS todays_bets_min_tier_idx     ON public.todays_bets(min_tier);

-- posts.access_level: same problem, two enum values cannot express five rungs.
-- The column NAME stays access_level for this slice on purpose. Renaming it
-- would drag in PostEditorClient's radios, AdminDashboard's post filters and
-- the admin posts API, none of which belongs in Slice 1.
ALTER TABLE public.posts ALTER COLUMN access_level DROP DEFAULT;
ALTER TABLE public.posts ALTER COLUMN access_level TYPE text USING access_level::text;
UPDATE public.posts SET access_level = CASE access_level
  WHEN 'free'    THEN 'retail'
  WHEN 'members' THEN 'desk'
  ELSE 'retail' END;
ALTER TABLE public.posts ALTER COLUMN access_level SET DEFAULT 'retail';
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_access_level_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_access_level_check
  CHECK (access_level IN ('retail','portfolio','desk','private','institutional'));

COMMIT;

-- VERIFY:
--   SELECT min_tier, count(*) FROM public.betting_systems GROUP BY 1 ORDER BY 1;
--   SELECT min_tier, count(*) FROM public.betting_trends  GROUP BY 1 ORDER BY 1;
--   SELECT min_tier, count(*) FROM public.todays_bets     GROUP BY 1 ORDER BY 1;
--   SELECT access_level, count(*) FROM public.posts       GROUP BY 1 ORDER BY 1;
--
-- Cross-check against the old flags -- expect ZERO rows:
--   SELECT id, is_free, is_elite, min_tier FROM public.betting_systems
--   WHERE (is_free AND min_tier <> 'retail') OR (NOT is_free AND min_tier = 'retail');


-- ===========================================================================
-- STEP 2b -- RUN THIS AS ITS OWN SEPARATE PASTE, after the above commits.
-- (Separate because a dollar-quote error would otherwise roll back the backfill.)
-- The body below is tagged $sync$ rather than a bare double-dollar, and no
-- comment here may carry that bare token -- see the note in step 3b.
-- ===========================================================================
-- COMPATIBILITY TRIGGER -- SLICE 1 ONLY. DELETE IN SLICE 2.
--
-- The admin editors still write is_free / is_elite: SportTabsSystem.tsx (938
-- lines), TrendsFilter.tsx (922), AdminSystemsTab, AdminTrendsTab, TodaysBets
-- and both XLSX importers. Rewriting all of them is Slice 2 work. Until then
-- this keeps min_tier -- the only column the READ paths consult -- in step with
-- the flags, so an admin editing a row cannot silently unpublish it.
--
--   TG_ARGV[0] = tier for an unflagged row
--   TG_ARGV[1] = that table's is_free default
--
-- It overwrites min_tier UNCONDITIONALLY, so it MUST BE DROPPED before Slice 2
-- flips the editors to write min_tier directly. Deliberately dumb: a "only if
-- the flags changed" version silently does the wrong thing on the first Slice 2
-- write, which is far harder to notice.
--
-- CREATE OR REPLACE FUNCTION public.sync_min_tier_from_flags()
-- RETURNS trigger LANGUAGE plpgsql AS $sync$
-- BEGIN
--   NEW.min_tier := CASE
--     WHEN COALESCE(NEW.is_elite, false)              THEN 'private'
--     WHEN COALESCE(NEW.is_free, TG_ARGV[1]::boolean) THEN 'retail'
--     ELSE TG_ARGV[0]
--   END;
--   RETURN NEW;
-- END $sync$;
--
-- DROP TRIGGER IF EXISTS betting_systems_sync_min_tier ON public.betting_systems;
-- CREATE TRIGGER betting_systems_sync_min_tier BEFORE INSERT OR UPDATE
--   ON public.betting_systems FOR EACH ROW
--   EXECUTE FUNCTION public.sync_min_tier_from_flags('private', 'false');
--
-- DROP TRIGGER IF EXISTS betting_trends_sync_min_tier ON public.betting_trends;
-- CREATE TRIGGER betting_trends_sync_min_tier BEFORE INSERT OR UPDATE
--   ON public.betting_trends FOR EACH ROW
--   EXECUTE FUNCTION public.sync_min_tier_from_flags('private', 'false');
--
-- DROP TRIGGER IF EXISTS todays_bets_sync_min_tier ON public.todays_bets;
-- CREATE TRIGGER todays_bets_sync_min_tier BEFORE INSERT OR UPDATE
--   ON public.todays_bets FOR EACH ROW
--   EXECUTE FUNCTION public.sync_min_tier_from_flags('portfolio', 'true');
--
-- TO REMOVE IN SLICE 2:
--   DROP TRIGGER betting_systems_sync_min_tier ON public.betting_systems;
--   DROP TRIGGER betting_trends_sync_min_tier  ON public.betting_trends;
--   DROP TRIGGER todays_bets_sync_min_tier     ON public.todays_bets;
--   DROP FUNCTION public.sync_min_tier_from_flags();
