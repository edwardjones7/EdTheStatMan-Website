-- ===========================================================================
-- v3 TIER LADDER -- STEP 4 of 5. Run after step 3 commits.
-- ===========================================================================
-- Recreates the posts policies dropped in steps 1 and 2, on the ladder.
--
-- THIS ALSO FIXES A DOCUMENTED DISAGREEMENT. The old policy in
-- add_elite_posts_rls.sql required `subscription_status = 'active'`, a column
-- the app deliberately never reads because the webhook set it once and never
-- cleared it -- so RLS considered lapsed members paid while resolveAccess()
-- correctly did not. The app dodged the contradiction by reading blog posts
-- through the service-role client.
--
-- Under the v3 model that column means "has a live Stripe subscription", so the
-- old policy would have denied every season-pass buyer outright. The policy
-- below gates on access_expires_at, exactly as resolveAccess() does. The
-- database and the application now agree.
--
-- This makes the service-role read in app/blog/**/page.tsx optional rather than
-- required. Do NOT remove it in this slice -- one change at a time.
-- ===========================================================================

DROP POLICY IF EXISTS "Anyone can view published free posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view all published posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view published retail posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts at or below their tier" ON public.posts;

CREATE POLICY "Anyone can view published retail posts"
  ON public.posts FOR SELECT
  USING (published = true AND access_level = 'retail');

CREATE POLICY "Members can view posts at or below their tier"
  ON public.posts FOR SELECT
  USING (
    published = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.is_admin = true
          OR (
            p.access_expires_at > now()
            AND array_position(
                  ARRAY['retail','portfolio','desk','private','institutional'],
                  p.subscription_tier
                ) >= array_position(
                  ARRAY['retail','portfolio','desk','private','institutional'],
                  public.posts.access_level
                )
          )
        )
    )
  );

-- VERIFY: as an anon session, a 'desk' post must not be selectable.
--   SET ROLE anon;
--   SELECT count(*) FROM public.posts WHERE access_level <> 'retail';  -- expect 0
--   RESET ROLE;
