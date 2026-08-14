-- Notifications: email opt-out + web push subscriptions.
--
-- Picks fire notifications on insert (app/api/admin/todays-bets POST). This
-- migration adds the two things that can't live in code: per-member email
-- preference, and the browser push endpoints we send to.

-- 1. Email preference -------------------------------------------------------
-- Default true: members opted in by signing up for a picks product. The token
-- backs one-click unsubscribe links so a logged-out click still resolves to a
-- single member without exposing their id.
alter table public.profiles
  add column if not exists notify_email boolean not null default true;

alter table public.profiles
  add column if not exists notify_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_notify_token_idx
  on public.profiles (notify_token);

-- 2. Web push subscriptions -------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Push services reissue the same endpoint for a re-subscribing browser, so
  -- this is what makes re-subscription an upsert instead of a duplicate blast.
  unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Members manage only their own subscriptions. Sending is done by the service
-- role, which bypasses RLS entirely.
create policy "Users read own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
