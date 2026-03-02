begin;

create table if not exists public.businesses (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_business_name_default()
returns trigger
language plpgsql
as $$
begin
  if new.name is null or btrim(new.name) = '' then
    new.name = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_businesses_set_name_default on public.businesses;

create trigger trg_businesses_set_name_default
before insert or update on public.businesses
for each row
execute function public.set_business_name_default();

create table if not exists public.chat_sessions (
  id text primary key,
  business_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id text primary key,
  session_id text not null,
  business_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_check check (role in ('user', 'assistant', 'system'))
);

create index if not exists idx_chat_sessions_business_updated
  on public.chat_sessions (business_id, updated_at desc);

create index if not exists idx_chat_messages_session_created
  on public.chat_messages (session_id, created_at asc);

create index if not exists idx_chat_messages_business_created
  on public.chat_messages (business_id, created_at asc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_sessions_business_id_fkey'
  ) then
    alter table public.chat_sessions
      add constraint chat_sessions_business_id_fkey
      foreign key (business_id)
      references public.businesses(id)
      on update cascade
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.chat_sessions validate constraint chat_sessions_business_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_business_id_fkey'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_business_id_fkey
      foreign key (business_id)
      references public.businesses(id)
      on update cascade
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.chat_messages validate constraint chat_messages_business_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_session_id_fkey'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_session_id_fkey
      foreign key (session_id)
      references public.chat_sessions(id)
      on update cascade
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.chat_messages validate constraint chat_messages_session_id_fkey;

create or replace function public.set_chat_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chat_sessions_set_updated_at on public.chat_sessions;

create trigger trg_chat_sessions_set_updated_at
before update on public.chat_sessions
for each row
execute function public.set_chat_sessions_updated_at();

revoke all on table public.businesses from public, anon, authenticated;
revoke all on table public.chat_sessions from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;

alter table public.businesses enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

alter table public.businesses force row level security;
alter table public.chat_sessions force row level security;
alter table public.chat_messages force row level security;

drop policy if exists businesses_deny_all on public.businesses;
drop policy if exists chat_sessions_deny_all on public.chat_sessions;
drop policy if exists chat_messages_deny_all on public.chat_messages;

create policy businesses_deny_all
on public.businesses
as restrictive
for all
to public
using (false)
with check (false);

create policy chat_sessions_deny_all
on public.chat_sessions
as restrictive
for all
to public
using (false)
with check (false);

create policy chat_messages_deny_all
on public.chat_messages
as restrictive
for all
to public
using (false)
with check (false);

commit;
