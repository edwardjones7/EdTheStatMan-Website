-- Page views tracking table
create table if not exists public.page_views (
  id         bigserial    primary key,
  path       text         not null,
  referrer   text,
  created_at timestamptz  default now() not null
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx       on public.page_views (path);

alter table public.page_views enable row level security;

-- Anyone (anon or authenticated) can record a page view
create policy "Anyone can insert page views"
  on public.page_views for insert
  with check (true);

-- No select policy for anon/authenticated — reads go through the service-role API route
