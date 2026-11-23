-- Migration: Native Device Push Tokens (Android, iOS & Web)
-- Date: 2026-11-23

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  token text not null,
  is_active boolean default true,
  updated_at timestamptz default now(),
  constraint uq_device_push_tokens_user_token unique (user_id, token)
);

create index if not exists idx_device_push_tokens_user_active on public.device_push_tokens(user_id, is_active);
create index if not exists idx_device_push_tokens_token on public.device_push_tokens(token);

-- Enable Row Level Security
alter table public.device_push_tokens enable row level security;

-- Policy: users can manage their own device tokens
drop policy if exists "Users can view their own push tokens" on public.device_push_tokens;
create policy "Users can view their own push tokens"
  on public.device_push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push tokens" on public.device_push_tokens;
create policy "Users can insert their own push tokens"
  on public.device_push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push tokens" on public.device_push_tokens;
create policy "Users can update their own push tokens"
  on public.device_push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push tokens" on public.device_push_tokens;
create policy "Users can delete their own push tokens"
  on public.device_push_tokens
  for delete
  using (auth.uid() = user_id);
