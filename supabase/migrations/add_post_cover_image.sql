-- Cover images for blog posts (v2 redesign)
-- Apply manually in the Supabase SQL editor.

alter table public.posts add column if not exists cover_image text;

-- Public bucket for post cover images
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public anyway; this covers the API path)
create policy "Public read post images" on storage.objects
  for select using (bucket_id = 'post-images');

-- Only admins can write
create policy "Admins manage post images" on storage.objects
  for all
  using (
    bucket_id = 'post-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'post-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
