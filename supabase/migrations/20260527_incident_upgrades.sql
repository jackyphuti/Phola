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
