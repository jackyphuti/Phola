-- Initial Base Schema Migration for Phola
-- Creates foundational tables, RLS policies, and storage setup.

create extension if not exists "pgcrypto";

-- =============================================================================
-- PROFILES
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  profile_photo_path text,
  pin_hash text,
  biometric_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- =============================================================================
-- INCIDENTS
-- =============================================================================
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  incident_type text not null,
  crime_type text,
  description text,
  location text,
  date_occurred timestamptz,
  perpetrator_relationship text,
  severity text,
  anonymous_report boolean not null default false,
  case_reference text,
  incident_metadata jsonb,
  evidence_files jsonb,
  saps_station_name text,
  saps_station_code text,
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.incidents enable row level security;

create policy "Users can view own incidents"
  on public.incidents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own incidents"
  on public.incidents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own incidents"
  on public.incidents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own incidents"
  on public.incidents for delete
  to authenticated
  using (auth.uid() = user_id);

-- =============================================================================
-- EMERGENCY CONTACTS
-- =============================================================================
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

create policy "Users can view own emergency contacts"
  on public.emergency_contacts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own emergency contacts"
  on public.emergency_contacts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own emergency contacts"
  on public.emergency_contacts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own emergency contacts"
  on public.emergency_contacts for delete
  to authenticated
  using (auth.uid() = user_id);

-- =============================================================================
-- STORAGE BUCKETS & POLICIES
-- =============================================================================
insert into storage.buckets (id, name, public)
values 
  ('profile-photos', 'profile-photos', true),
  ('incident-evidence', 'incident-evidence', false)
on conflict (id) do nothing;

-- Storage policies for profile-photos
create policy "Anyone can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Authenticated users can upload profile photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos');

create policy "Users can update their profile photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos');

create policy "Users can delete their profile photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-photos');

-- Storage policies for incident-evidence
create policy "Users can view own evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own evidence"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
