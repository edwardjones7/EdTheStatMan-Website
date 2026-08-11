-- Elite-only content flags. Run AFTER add_elite_tier.sql has committed.
--
-- Rows with is_elite = true are visible only to elite members (and admins).
-- Like is_free, the flag is enforced in server pages — locked rows are
-- dropped/redacted server-side before anything crosses the wire.

alter table public.betting_systems add column if not exists is_elite boolean not null default false;
alter table public.betting_trends  add column if not exists is_elite boolean not null default false;
alter table public.todays_bets     add column if not exists is_elite boolean not null default false;
