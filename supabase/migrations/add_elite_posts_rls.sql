-- Lets elite members read members-only blog posts.
-- Run AFTER add_elite_tier.sql has committed (separate execution).
--
-- Recreates the existing policy from schema.sql with 'elite' added to the
-- tier list. Keeps the subscription_status check for parity with the
-- original policy, even though app-side gating ignores subscription_status.

drop policy if exists "Members can view all published posts" on public.posts;

create policy "Members can view all published posts"
  on public.posts for select
  using (
    published = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and subscription_tier in ('basic', 'premium', 'elite')
      and subscription_status = 'active'
    )
  );
