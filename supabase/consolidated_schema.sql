-- ==========================================
-- Migration: 00000000_init_schema.sql
-- ==========================================
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

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile" on public.profiles for delete
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

drop policy if exists "Users can view own incidents" on public.incidents;
create policy "Users can view own incidents" on public.incidents for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own incidents" on public.incidents;
create policy "Users can insert own incidents" on public.incidents for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own incidents" on public.incidents;
create policy "Users can update own incidents" on public.incidents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own incidents" on public.incidents;
create policy "Users can delete own incidents" on public.incidents for delete
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

drop policy if exists "Users can view own emergency contacts" on public.emergency_contacts;
create policy "Users can view own emergency contacts" on public.emergency_contacts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own emergency contacts" on public.emergency_contacts;
create policy "Users can insert own emergency contacts" on public.emergency_contacts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own emergency contacts" on public.emergency_contacts;
create policy "Users can update own emergency contacts" on public.emergency_contacts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own emergency contacts" on public.emergency_contacts;
create policy "Users can delete own emergency contacts" on public.emergency_contacts for delete
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
drop policy if exists "Anyone can view profile photos" on storage.objects;
create policy "Anyone can view profile photos" on storage.objects for select
  using (bucket_id = 'profile-photos');

drop policy if exists "Authenticated users can upload profile photos" on storage.objects;
create policy "Authenticated users can upload profile photos" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos');

drop policy if exists "Users can update their profile photos" on storage.objects;
create policy "Users can update their profile photos" on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos');

drop policy if exists "Users can delete their profile photos" on storage.objects;
create policy "Users can delete their profile photos" on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-photos');

-- Storage policies for incident-evidence
drop policy if exists "Users can view own evidence" on storage.objects;
create policy "Users can view own evidence" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own evidence" on storage.objects;
create policy "Users can upload own evidence" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own evidence" on storage.objects;
create policy "Users can delete own evidence" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'incident-evidence' and
    (storage.foldername(name))[1] = auth.uid()::text
  );


-- ==========================================
-- Migration: 20260521_profile_photo_path.sql
-- ==========================================
alter table public.profiles
add column if not exists profile_photo_path text;


-- ==========================================
-- Migration: 20260521_profile_photos.sql
-- ==========================================
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;


-- ==========================================
-- Migration: 20260521_realtime_incidents.sql
-- ==========================================
-- Enable realtime on incidents and emit private broadcasts automatically.

alter table public.incidents replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incidents'
  ) then
    execute 'alter publication supabase_realtime add table public.incidents';
  end if;
end
$$;

drop policy if exists "authenticated can receive broadcasts" on "realtime"."messages";

create policy "authenticated can receive broadcasts"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.topic() = 'user:' || (select auth.uid())::text || ':incidents'
);

create or replace function public.broadcast_incident_changes()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  target_user_id uuid;
begin
  target_user_id := case
    when TG_OP = 'DELETE' then OLD.user_id
    else NEW.user_id
  end;

  perform realtime.broadcast_changes(
    'user:' || target_user_id::text || ':incidents',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  return null;
end;
$$;

drop trigger if exists broadcast_incidents_changes on public.incidents;

create trigger broadcast_incidents_changes
after insert or update or delete on public.incidents
for each row
execute function public.broadcast_incident_changes();


-- ==========================================
-- Migration: 20260525000000_create_passkeys_table.sql
-- ==========================================
-- Create passkeys table for storing WebAuthn credentials
CREATE TABLE IF NOT EXISTS passkeys (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, credential_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);

-- Enable RLS on passkeys table
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
drop policy if exists "Users can view their own passkeys" on passkeys;
create policy "Users can view their own passkeys" on passkeys FOR SELECT
  USING (auth.uid() = user_id);

drop policy if exists "Users can insert their own passkeys" on passkeys;
create policy "Users can insert their own passkeys" on passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

drop policy if exists "Users can update their own passkeys" on passkeys;
create policy "Users can update their own passkeys" on passkeys FOR UPDATE
  USING (auth.uid() = user_id);

drop policy if exists "Users can delete their own passkeys" on passkeys;
create policy "Users can delete their own passkeys" on passkeys FOR DELETE
  USING (auth.uid() = user_id);


-- ==========================================
-- Migration: 20260527_incident_upgrades.sql
-- ==========================================
alter table if exists public.incidents
  add column if not exists crime_type text,
  add column if not exists anonymous_report boolean not null default false,
  add column if not exists incident_metadata jsonb,
  add column if not exists evidence_files jsonb,
  add column if not exists saps_station_name text,
  add column if not exists saps_station_code text,
  add column if not exists case_reference text;

insert into storage.buckets (id, name, public)
values ('incident-evidence', 'incident-evidence', false)
on conflict (id) do nothing;


-- ==========================================
-- Migration: 20260527_push_subscriptions.sql
-- ==========================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  content_encoding text,
  user_agent text,
  is_active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create index if not exists push_subscriptions_is_active_idx
  on public.push_subscriptions(is_active);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions" on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions" on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions" on public.push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions" on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);


-- ==========================================
-- Migration: 20261025000000_add_user_profile_fields.sql
-- ==========================================
-- Add first_name, last_name, and date_of_birth to profiles table
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists date_of_birth date;


