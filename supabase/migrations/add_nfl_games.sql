-- NFL games for the Elite weekly hub, synced from ESPN's public scoreboard API.
--
-- SECURITY: RLS is enabled with NO select policy on purpose. writeup_html is
-- elite-only IP — all reads go through server pages using the service-role
-- client, which redact via toPublicGame() before anything crosses the wire.
-- Do NOT add a public select policy to this table.

create table public.nfl_games (
  id uuid primary key default gen_random_uuid(),
  espn_event_id text not null unique,
  season int not null,                    -- e.g. 2026
  season_type int not null,               -- ESPN: 2 = regular season, 3 = postseason
  week int not null,
  kickoff timestamptz,
  status text not null default 'pre',     -- ESPN state: pre | in | post
  home_team text not null,
  home_abbrev text not null,
  away_team text not null,
  away_abbrev text not null,
  home_score int,
  away_score int,
  slug text not null unique,              -- e.g. '2026-wk1-kc-at-buf' (frozen after insert for SEO)
  brief text not null default '',         -- public teaser / SEO copy, admin-owned
  writeup_html text not null default '',  -- ELITE-ONLY analysis, admin-owned
  writeup_updated_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger nfl_games_updated_at
  before update on public.nfl_games
  for each row execute function public.handle_updated_at();

alter table public.nfl_games enable row level security;

create index nfl_games_week_idx on public.nfl_games (season, season_type, week);
create index nfl_games_slug_idx on public.nfl_games (slug);

-- Admin-curated links from a game to the systems/trends that apply to it.
-- Same RLS posture: service-role reads only.

create table public.nfl_game_systems (
  game_id uuid not null references public.nfl_games(id) on delete cascade,
  system_id uuid not null references public.betting_systems(id) on delete cascade,
  primary key (game_id, system_id)
);

create table public.nfl_game_trends (
  game_id uuid not null references public.nfl_games(id) on delete cascade,
  trend_id uuid not null references public.betting_trends(id) on delete cascade,
  primary key (game_id, trend_id)
);

alter table public.nfl_game_systems enable row level security;
alter table public.nfl_game_trends enable row level security;
