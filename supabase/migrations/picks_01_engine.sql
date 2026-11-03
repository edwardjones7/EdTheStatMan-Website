-- Picks engine: Ed's X posts become drafts, drafts become graded public picks.
--
-- WHY. Ed posts a large free volume on X, player props included, and none of
-- it reaches the site (vault Decisions 2026-10-15, "The picks engine reads Ed's
-- X posts"). The engine reads his timeline, parses each post into structured
-- picks, and queues them for Ed to approve. Nothing publishes without that tap.
-- This migration adds the two things that needs:
--
--   1. Columns on todays_bets, so a pick can carry what the parser captures and
--      what a public page needs:
--        odds       American price at posting (-110, +130). The records in
--                   lib/records.ts grade units from this, and fall back to -110
--                   (labelled as such) when it is null -- which is every row
--                   before this migration.
--        market     spread | total | moneyline | prop | other.
--        slug       the public URL, /picks/<slug>. UNIQUE, and permanent once a
--                   page is indexed, so nothing ever rewrites it.
--        posted_at  when Ed posted it (the X timestamp, or the admin save).
--        source     admin | x. NULL on rows from before the engine, on purpose:
--                   we do not know how each of those 200-odd rows was entered.
--        x_post_id  the post it came from. NOT unique: one post can carry four
--                   picks.
--
--   2. pick_drafts, the review queue. One row per X post (or pasted post),
--      holding the parser's output until Ed approves, corrects or rejects it.
--      `skipped` is for posts the parser found no pick in (results recaps,
--      chatter): they are kept so the ingest never re-reads them, and hidden
--      from the queue by default.
--
-- SAFE ORDER: run this BEFORE or AFTER the code deploy, either works.
--   - Before: nothing reads the new columns until the code ships.
--   - After: the code probes for `todays_bets.slug` and for `pick_drafts`
--     (lib/picks/columns.ts) and degrades: /picks renders and links by id, the
--     admin editor saves picks without slugs, and the queue says the migration
--     is missing instead of failing. Approving drafts needs this applied.
--
-- The slug index is a FULL unique index, not a partial one. A partial index
-- cannot serve ON CONFLICT through PostgREST (42P10), the trap that once
-- dropped every subscription revenue row (docs/MIGRATIONS.md). NULLs do not
-- collide in a unique index, so legacy rows without a slug are fine.

-- ---------------------------------------------------------------------------
-- 1. todays_bets columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS odds      integer;
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS market    text;
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS slug      text;
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS source    text;
ALTER TABLE public.todays_bets ADD COLUMN IF NOT EXISTS x_post_id text;

ALTER TABLE public.todays_bets DROP CONSTRAINT IF EXISTS todays_bets_market_check;
ALTER TABLE public.todays_bets ADD CONSTRAINT todays_bets_market_check
  CHECK (market IS NULL OR market IN ('spread','total','moneyline','prop','other'));

ALTER TABLE public.todays_bets DROP CONSTRAINT IF EXISTS todays_bets_source_check;
ALTER TABLE public.todays_bets ADD CONSTRAINT todays_bets_source_check
  CHECK (source IS NULL OR source IN ('admin','x'));

-- An American price is never between -100 and +100. Rejecting those here
-- catches a spread typed into the odds field, which would otherwise grade a
-- -3.5 favourite as a +3.5 payout.
ALTER TABLE public.todays_bets DROP CONSTRAINT IF EXISTS todays_bets_odds_check;
ALTER TABLE public.todays_bets ADD CONSTRAINT todays_bets_odds_check
  CHECK (odds IS NULL OR odds <= -100 OR odds >= 100);

CREATE UNIQUE INDEX IF NOT EXISTS todays_bets_slug_key ON public.todays_bets (slug);
CREATE INDEX IF NOT EXISTS todays_bets_x_post_id_idx ON public.todays_bets (x_post_id);

-- Backfill: every existing pick gets a page. posted_at is the save time, the
-- best record of when it went out.
--
-- The slug is date + sport + a short id, and DELIBERATELY NOT the bet text: a
-- members' pick's URL must not spell out the pick that its page hides until it
-- is graded. New free picks get the bet in their slug (lib/picks/slug.ts);
-- old ones keep this plainer shape, which is just as stable.
UPDATE public.todays_bets
SET posted_at = COALESCE(posted_at, created_at)
WHERE posted_at IS NULL;

UPDATE public.todays_bets
SET slug = concat_ws('-',
  NULLIF(regexp_replace(lower(coalesce(date, '')), '[^a-z0-9]+', '-', 'g'), ''),
  NULLIF(regexp_replace(lower(coalesce(sport, '')), '[^a-z0-9]+', '-', 'g'), ''),
  'pick',
  left(replace(id::text, '-', ''), 6)
)
WHERE slug IS NULL;

COMMENT ON COLUMN public.todays_bets.odds IS 'American odds at posting. NULL = not recorded; records grade those at -110 and say so.';
COMMENT ON COLUMN public.todays_bets.slug IS 'Public URL /picks/<slug>. Permanent once indexed. Never contains a members-only bet.';
COMMENT ON COLUMN public.todays_bets.source IS 'admin | x. NULL = entered before the picks engine.';

-- ---------------------------------------------------------------------------
-- 2. pick_drafts, the review queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pick_drafts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE (full, see the header) so the ingest can insert with
  -- ON CONFLICT DO NOTHING and never queue a post twice. NULL for a pasted
  -- post with no X link.
  x_post_id   text        UNIQUE,
  post_text   text        NOT NULL,
  post_url    text,
  posted_at   timestamptz,
  -- { parser: 'ai' | 'regex', model?, error?, picks: [...], note? }
  parsed      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','skipped')),
  pick_ids    uuid[],
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS pick_drafts_status_idx ON public.pick_drafts (status, posted_at DESC);

-- Service role only. RLS on with no policies means the anon and authenticated
-- keys read and write nothing; every access goes through the admin routes.
ALTER TABLE public.pick_drafts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
--   SELECT count(*) AS picks, count(slug) AS with_slug, count(posted_at) AS with_posted
--   FROM public.todays_bets;                      -- expect all three equal
--   SELECT slug, count(*) FROM public.todays_bets GROUP BY slug HAVING count(*) > 1;
--                                                 -- expect no rows
--   SELECT count(*) FROM public.pick_drafts;      -- expect 0
