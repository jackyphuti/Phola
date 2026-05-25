-- Enable realtime on incidents and emit private broadcasts automatically.

alter table public.incidents replica identity full;

alter publication supabase_realtime add table public.incidents;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'authenticated can receive broadcasts'
  ) then
    execute '
      create policy "authenticated can receive broadcasts"
      on "realtime"."messages"
      for select
      to authenticated
      using (true)
    ';
  end if;
end
$$;

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