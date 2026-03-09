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
