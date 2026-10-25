-- Add first_name, last_name, and date_of_birth to profiles table
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists date_of_birth date;
