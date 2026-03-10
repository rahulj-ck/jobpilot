-- Run this in Supabase SQL Editor

create table if not exists apply_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id text not null,
  job_title text,
  company text,
  job_url text,
  score integer,
  status text default 'queued', -- queued | applying | applied | failed
  error_msg text,
  cover_letter text,
  applied_at timestamptz,
  created_at timestamptz default now()
);

create index on apply_queue(user_id, status);
create index on apply_queue(status, created_at);

-- RLS
alter table apply_queue enable row level security;

create policy "Users can read own queue"
  on apply_queue for select
  using (auth.uid() = user_id);

create policy "Users can insert own queue"
  on apply_queue for insert
  with check (auth.uid() = user_id);

create policy "Users can update own queue"
  on apply_queue for update
  using (auth.uid() = user_id);

-- Service role can update any (for the apply worker)
create policy "Service role can update queue"
  on apply_queue for update
  using (true)
  with check (true);
