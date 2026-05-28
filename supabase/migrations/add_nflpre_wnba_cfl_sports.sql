-- Add nflpre, wnba, cfl to the allowed sport codes on betting_systems and betting_trends.
-- Apply in Supabase SQL editor.

alter table public.betting_systems drop constraint if exists betting_systems_sport_check;
alter table public.betting_systems
  add constraint betting_systems_sport_check
  check (sport in ('nfl', 'nflpre', 'cfb', 'cfl', 'nba', 'wnba', 'cbb'));

alter table public.betting_trends drop constraint if exists betting_trends_sport_check;
alter table public.betting_trends
  add constraint betting_trends_sport_check
  check (sport in ('nfl', 'nflpre', 'cfb', 'cfl', 'nba', 'wnba', 'cbb'));
