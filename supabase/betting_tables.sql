-- Betting Systems & Trends Tables
-- Run this in the Supabase SQL Editor

drop table if exists public.betting_trends cascade;
drop table if exists public.betting_systems cascade;

create table public.betting_systems (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('nfl', 'cfb', 'nba', 'cbb')),
  name text not null,
  record_wins int not null default 0,
  record_losses int not null default 0,
  streak text not null default '—',
  status text not null default 'Active',
  status_active boolean not null default true,
  is_free boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.betting_trends (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('nfl', 'cfb', 'nba', 'cbb')),
  team text not null,
  ats_wins int not null default 0,
  ats_losses int not null default 0,
  ou_wins int not null default 0,
  ou_losses int not null default 0,
  home_ats_wins int not null default 0,
  home_ats_losses int not null default 0,
  away_ats_wins int not null default 0,
  away_ats_losses int not null default 0,
  free_tags jsonb not null default '[]',
  paid_tag jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger betting_systems_updated_at
  before update on public.betting_systems
  for each row execute function public.handle_updated_at();

create trigger betting_trends_updated_at
  before update on public.betting_trends
  for each row execute function public.handle_updated_at();

alter table public.betting_systems enable row level security;
alter table public.betting_trends enable row level security;

create policy "Anyone can read betting systems"
  on public.betting_systems for select using (true);

create policy "Anyone can read betting trends"
  on public.betting_trends for select using (true);

create policy "Admins can manage betting systems"
  on public.betting_systems for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can manage betting trends"
  on public.betting_trends for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create index betting_systems_sport_idx on public.betting_systems(sport, sort_order);
create index betting_trends_sport_idx on public.betting_trends(sport, sort_order);
