-- Run this in your Supabase SQL Editor

-- 1. User profiles table
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  name text,
  title text,
  skills text,
  experience text,
  location text,
  bio text,
  salary_min integer,
  salary_max integer,
  resume_url text,
  resume_filename text,
  updated_at timestamptz default now()
);

-- RLS: users can only see/edit their own profile
alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);

-- 2. Storage bucket for resumes
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict do nothing;

-- Storage policy: users can upload to their own folder
create policy "Users can upload own resume"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can read resumes"
  on storage.objects for select
  using (bucket_id = 'resumes');

create policy "Users can update own resume"
  on storage.objects for update
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

-- Add missing fields to user_profiles for auto-apply
alter table user_profiles add column if not exists email text;
alter table user_profiles add column if not exists phone text;
alter table user_profiles add column if not exists linkedin text;
alter table user_profiles add column if not exists school text;
alter table user_profiles add column if not exists degree text;
alter table user_profiles add column if not exists discipline text;
alter table user_profiles add column if not exists work_auth text default 'yes';
alter table user_profiles add column if not exists need_sponsorship text default 'no';
alter table user_profiles add column if not exists salary_min integer;
alter table user_profiles add column if not exists salary_max integer;
