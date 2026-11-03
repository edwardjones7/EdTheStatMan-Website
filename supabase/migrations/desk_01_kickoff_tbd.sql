-- Desk: mark games whose start time ESPN has not set yet.
--
-- ESPN files an unscheduled game (a flexed NFL week 17/18 slot, most of a
-- college basketball opening night) at midnight Eastern on its date and flags
-- it `timeValid: false`. Without the flag the board printed that placeholder as
-- a real 12:00 AM start. The clock cannot be used to guess it either: a Hawaii
-- home game really does tip at 11:59 PM Eastern.
--
-- Safe to apply before or after the deploy. lib/desk-sync.ts probes for the
-- column and only writes it once it exists; the next sync fills it in.

alter table public.nfl_games
  add column if not exists kickoff_tbd boolean not null default false;
