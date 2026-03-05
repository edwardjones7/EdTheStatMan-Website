-- EdTheStatMan Database Schema
-- Run this in the Supabase SQL Editor

-- Drop existing objects cleanly (safe on a fresh project)
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.posts cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_updated_at() cascade;
drop type if exists access_level;
drop type if exists subscription_status;
drop type if exists subscription_tier;

-- Enums
create type subscription_tier as enum ('free', 'basic', 'premium');
create type subscription_status as enum ('active', 'canceled', 'past_due', 'trialing', 'incomplete');
create type access_level as enum ('free', 'members');

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  subscription_tier subscription_tier not null default 'free',
  subscription_status subscription_status,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Blog posts table
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null,
  excerpt text,
  tag text not null default 'general',
  access_level access_level not null default 'free',
  published boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Posts policies
create policy "Anyone can view published free posts"
  on public.posts for select
  using (published = true and access_level = 'free');

create policy "Members can view all published posts"
  on public.posts for select
  using (
    published = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and subscription_tier in ('basic', 'premium')
      and subscription_status = 'active'
    )
  );

create policy "Admins can do everything with posts"
  on public.posts for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Indexes
create index posts_slug_idx on public.posts(slug);
create index posts_published_idx on public.posts(published, published_at desc);
create index posts_access_level_idx on public.posts(access_level);
create index profiles_stripe_customer_idx on public.profiles(stripe_customer_id);
create index profiles_tier_idx on public.profiles(subscription_tier, subscription_status);
