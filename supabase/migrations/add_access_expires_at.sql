-- Migration: add access_expires_at to profiles
-- Run this in the Supabase SQL Editor

alter table public.profiles
  add column if not exists access_expires_at timestamptz;
