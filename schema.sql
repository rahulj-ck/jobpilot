-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/_/sql

create table if not exists jobs (
  id          text primary key,
  title       text not null,
  company     text not null,
  location    text,
  salary      text,
  type        text default 'Full-time',
  tags        text[] default '{}',
  posted_at   timestamptz,
  logo        text,
  url         text,
  description text,
  source      text,
  scraped_at  timestamptz default now()
);

-- Fast search indexes
create index if not exists jobs_title_idx     on jobs using gin(to_tsvector('english', coalesce(title,'')));
create index if not exists jobs_desc_idx      on jobs using gin(to_tsvector('english', coalesce(description,'')));
create index if not exists jobs_scraped_idx   on jobs (scraped_at desc);
create index if not exists jobs_source_idx    on jobs (source);

-- Row level security
alter table jobs enable row level security;

drop policy if exists "Public read"    on jobs;
drop policy if exists "Service insert" on jobs;
drop policy if exists "Service upsert" on jobs;

create policy "Public read"    on jobs for select using (true);
create policy "Service insert" on jobs for insert with check (true);
create policy "Service upsert" on jobs for update using (true);

-- User profiles (resume data) — one per auth user
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  title         text not null default '',
  skills        text not null default '',
  experience    text not null default '',
  location      text not null default '',
  salary_min    int not null default 0,
  salary_max    int not null default 0,
  bio           text not null default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users read own profile" on profiles;
drop policy if exists "Users insert own profile" on profiles;
drop policy if exists "Users update own profile" on profiles;

create policy "Users read own profile"   on profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
