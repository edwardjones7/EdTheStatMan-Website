-- Migration: add date and team columns to betting_systems and betting_trends
-- Run this in the Supabase SQL Editor (do NOT re-run betting_tables.sql — it drops tables)

alter table public.betting_systems
  add column if not exists date text not null default '',
  add column if not exists team text not null default '';

alter table public.betting_trends
  add column if not exists date text not null default '',
  add column if not exists team text not null default '';
