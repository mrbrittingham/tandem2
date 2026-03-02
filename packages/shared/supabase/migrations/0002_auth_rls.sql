begin;

create table if not exists public.operator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

grant select, insert, update on table public.operator_profiles to authenticated;
grant select on table public.business_memberships to authenticated;
grant select on table public.businesses to authenticated;
grant select, insert, update, delete on table public.chat_sessions to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;

alter table public.operator_profiles enable row level security;
alter table public.business_memberships enable row level security;
alter table public.businesses enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists businesses_deny_all on public.businesses;
drop policy if exists chat_sessions_deny_all on public.chat_sessions;
drop policy if exists chat_messages_deny_all on public.chat_messages;

drop policy if exists operator_profiles_select_own on public.operator_profiles;
drop policy if exists operator_profiles_insert_own on public.operator_profiles;
drop policy if exists operator_profiles_update_own on public.operator_profiles;
drop policy if exists business_memberships_select_own on public.business_memberships;
drop policy if exists businesses_select_member on public.businesses;
drop policy if exists chat_sessions_select_member on public.chat_sessions;
drop policy if exists chat_sessions_insert_member on public.chat_sessions;
drop policy if exists chat_sessions_update_member on public.chat_sessions;
drop policy if exists chat_sessions_delete_member on public.chat_sessions;
drop policy if exists chat_messages_select_member on public.chat_messages;
drop policy if exists chat_messages_insert_member on public.chat_messages;
drop policy if exists chat_messages_update_member on public.chat_messages;
drop policy if exists chat_messages_delete_member on public.chat_messages;

create policy operator_profiles_select_own
on public.operator_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy operator_profiles_insert_own
on public.operator_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy operator_profiles_update_own
on public.operator_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy business_memberships_select_own
on public.business_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy businesses_select_member
on public.businesses
for select
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = businesses.id
      and membership.user_id = auth.uid()
  )
);

create policy chat_sessions_select_member
on public.chat_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_sessions.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_sessions_insert_member
on public.chat_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_sessions.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_sessions_update_member
on public.chat_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_sessions.business_id
      and membership.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_sessions.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_sessions_delete_member
on public.chat_sessions
for delete
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_sessions.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_messages_select_member
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_messages.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_messages_insert_member
on public.chat_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_messages.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_messages_update_member
on public.chat_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_messages.business_id
      and membership.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_messages.business_id
      and membership.user_id = auth.uid()
  )
);

create policy chat_messages_delete_member
on public.chat_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = chat_messages.business_id
      and membership.user_id = auth.uid()
  )
);

create or replace function public.bootstrap_membership(business_id text, role text default 'owner')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  requested_role text := coalesce(nullif(btrim(role), ''), 'owner');
  membership_count bigint;
  is_existing_member boolean;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if business_id is null or btrim(business_id) = '' then
    raise exception 'business_id required';
  end if;

  if requested_role not in ('owner', 'admin', 'member') then
    raise exception 'invalid role';
  end if;

  select email
  into current_user_email
  from auth.users
  where id = current_user_id;

  insert into public.operator_profiles (user_id, email)
  values (current_user_id, current_user_email)
  on conflict (user_id)
  do update set email = excluded.email;

  insert into public.businesses (id, name)
  values (business_id, business_id)
  on conflict (id)
  do nothing;

  select count(*)
  into membership_count
  from public.business_memberships membership
  where membership.business_id = bootstrap_membership.business_id;

  select exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = bootstrap_membership.business_id
      and membership.user_id = current_user_id
  )
  into is_existing_member;

  if membership_count > 0 and not is_existing_member then
    raise exception 'Business already has members';
  end if;

  if not is_existing_member then
    insert into public.business_memberships (business_id, user_id, role)
    values (
      bootstrap_membership.business_id,
      current_user_id,
      case when membership_count = 0 then requested_role else 'member' end
    )
    on conflict (business_id, user_id)
    do nothing;
  end if;
end;
$$;

revoke all on function public.bootstrap_membership(text, text) from public;
grant execute on function public.bootstrap_membership(text, text) to authenticated;

commit;
