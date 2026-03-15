begin;

create extension if not exists pgcrypto;

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

create table if not exists public.business_locations (
	id uuid primary key default gen_random_uuid(),
	business_id text not null references public.businesses(id) on delete cascade,
	slug text not null,
	name text not null,
	address text,
	created_by uuid not null references auth.users(id) on delete restrict,
	created_at timestamptz not null default now(),
	unique (business_id, slug)
);

create table if not exists public.business_location_configs (
	location_id uuid primary key references public.business_locations(id) on delete cascade,
	assistant_config jsonb not null default '{}'::jsonb,
	knowledge_config jsonb not null default '{}'::jsonb,
	handoff_config jsonb not null default '{}'::jsonb,
	widget_config jsonb not null default '{}'::jsonb,
	integrations_config jsonb not null default '{}'::jsonb,
	updated_at timestamptz not null default now()
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

grant select, insert, update on table public.operator_profiles to authenticated;
grant select on table public.business_memberships to authenticated;
grant select on table public.businesses to authenticated;
grant select, insert, update, delete on table public.chat_sessions to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;
grant select, insert, update, delete on table public.business_locations to authenticated;
grant select, insert, update, delete on table public.business_location_configs to authenticated;

revoke all on table public.businesses from public;
revoke all on table public.chat_sessions from public;
revoke all on table public.chat_messages from public;

alter table public.businesses enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.operator_profiles enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_location_configs enable row level security;

alter table public.businesses force row level security;
alter table public.chat_sessions force row level security;
alter table public.chat_messages force row level security;

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
drop policy if exists business_locations_select_member on public.business_locations;
drop policy if exists business_locations_insert_member on public.business_locations;
drop policy if exists business_locations_update_member on public.business_locations;
drop policy if exists business_locations_delete_member on public.business_locations;
drop policy if exists business_location_configs_select_member on public.business_location_configs;
drop policy if exists business_location_configs_insert_member on public.business_location_configs;
drop policy if exists business_location_configs_update_member on public.business_location_configs;
drop policy if exists business_location_configs_delete_member on public.business_location_configs;

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
		from public.business_memberships as memberships
		where memberships.business_id = businesses.id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_sessions_select_member
on public.chat_sessions
for select
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_sessions.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_sessions_insert_member
on public.chat_sessions
for insert
to authenticated
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_sessions.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_sessions_update_member
on public.chat_sessions
for update
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_sessions.business_id
			and memberships.user_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_sessions.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_sessions_delete_member
on public.chat_sessions
for delete
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_sessions.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_messages_select_member
on public.chat_messages
for select
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_messages.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_messages_insert_member
on public.chat_messages
for insert
to authenticated
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_messages.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_messages_update_member
on public.chat_messages
for update
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_messages.business_id
			and memberships.user_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_messages.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy chat_messages_delete_member
on public.chat_messages
for delete
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = chat_messages.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_locations_select_member
on public.business_locations
for select
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = business_locations.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_locations_insert_member
on public.business_locations
for insert
to authenticated
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = business_locations.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_locations_update_member
on public.business_locations
for update
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = business_locations.business_id
			and memberships.user_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = business_locations.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_locations_delete_member
on public.business_locations
for delete
to authenticated
using (
	exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = business_locations.business_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_location_configs_select_member
on public.business_location_configs
for select
to authenticated
using (
	exists (
		select 1
		from public.business_locations as locations
		join public.business_memberships as memberships
			on memberships.business_id = locations.business_id
		where locations.id = business_location_configs.location_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_location_configs_insert_member
on public.business_location_configs
for insert
to authenticated
with check (
	exists (
		select 1
		from public.business_locations as locations
		join public.business_memberships as memberships
			on memberships.business_id = locations.business_id
		where locations.id = business_location_configs.location_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_location_configs_update_member
on public.business_location_configs
for update
to authenticated
using (
	exists (
		select 1
		from public.business_locations as locations
		join public.business_memberships as memberships
			on memberships.business_id = locations.business_id
		where locations.id = business_location_configs.location_id
			and memberships.user_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.business_locations as locations
		join public.business_memberships as memberships
			on memberships.business_id = locations.business_id
		where locations.id = business_location_configs.location_id
			and memberships.user_id = auth.uid()
	)
);

create policy business_location_configs_delete_member
on public.business_location_configs
for delete
to authenticated
using (
	exists (
		select 1
		from public.business_locations as locations
		join public.business_memberships as memberships
			on memberships.business_id = locations.business_id
		where locations.id = business_location_configs.location_id
			and memberships.user_id = auth.uid()
	)
);

create or replace function public.bootstrap_membership(business_id text, role text default 'owner')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
	v_business_id alias for $1;
	v_role alias for $2;
	current_user_id uuid := auth.uid();
	current_user_email text;
	requested_role text := coalesce(nullif(btrim(v_role), ''), 'owner');
	membership_count bigint;
	is_existing_member boolean;
begin
	if current_user_id is null then
		raise exception 'Not authenticated';
	end if;

	if v_business_id is null or btrim(v_business_id) = '' then
		raise exception 'business_id required';
	end if;

	if requested_role not in ('owner', 'admin', 'member') then
		raise exception 'invalid role';
	end if;

	select users.email
	into current_user_email
	from auth.users as users
	where users.id = current_user_id;

	insert into public.operator_profiles as profiles (user_id, email)
	values (current_user_id, current_user_email)
	on conflict (user_id)
	do update set email = excluded.email;

	insert into public.businesses as businesses (id, name)
	values (v_business_id, v_business_id)
	on conflict (id)
	do nothing;

	select count(*)
	into membership_count
	from public.business_memberships as memberships
	where memberships.business_id = v_business_id;

	select exists (
		select 1
		from public.business_memberships as memberships
		where memberships.business_id = v_business_id
			and memberships.user_id = current_user_id
	)
	into is_existing_member;

	if membership_count > 0 and not is_existing_member then
		raise exception 'Business already has members';
	end if;

	if not is_existing_member then
		insert into public.business_memberships as memberships (business_id, user_id, role)
		values (
			v_business_id,
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

create or replace function public.create_business_location(
	p_name text,
	p_address text default null,
	p_copy_from_location_id uuid default null
)
returns table (
	id uuid,
	business_id text,
	slug text,
	name text,
	address text,
	copied_from uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
	v_user_id uuid := auth.uid();
	v_business_id text;
	v_source_business_id text;
	v_slug_base text;
	v_slug text;
	v_counter integer := 1;
	v_location_id uuid;
begin
	if v_user_id is null then
		raise exception 'Not authenticated';
	end if;

	if p_name is null or btrim(p_name) = '' then
		raise exception 'name is required';
	end if;

	select memberships.business_id
	into v_business_id
	from public.business_memberships as memberships
	where memberships.user_id = v_user_id
	order by memberships.created_at asc
	limit 1;

	if v_business_id is null then
		raise exception 'No business membership found';
	end if;

	if p_copy_from_location_id is not null then
		select locations.business_id
		into v_source_business_id
		from public.business_locations as locations
		where locations.id = p_copy_from_location_id;

		if v_source_business_id is null then
			raise exception 'Source location not found';
		end if;

		if v_source_business_id <> v_business_id then
			raise exception 'Source location belongs to another business';
		end if;
	end if;

	v_slug_base := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
	v_slug_base := regexp_replace(v_slug_base, '(^-|-$)', '', 'g');
	if v_slug_base = '' then
		v_slug_base := 'location';
	end if;

	v_slug := v_slug_base;
	while exists (
		select 1
		from public.business_locations as locations
		where locations.business_id = v_business_id
			and locations.slug = v_slug
	) loop
		v_counter := v_counter + 1;
		v_slug := v_slug_base || '-' || v_counter::text;
	end loop;

	insert into public.business_locations as locations (
		business_id,
		slug,
		name,
		address,
		created_by
	)
	values (
		v_business_id,
		v_slug,
		btrim(p_name),
		nullif(btrim(coalesce(p_address, '')), ''),
		v_user_id
	)
	returning locations.id into v_location_id;

	if p_copy_from_location_id is not null then
		insert into public.business_location_configs as configs (
			location_id,
			assistant_config,
			knowledge_config,
			handoff_config,
			widget_config,
			integrations_config
		)
		select
			v_location_id,
			source.assistant_config,
			source.knowledge_config,
			source.handoff_config,
			source.widget_config,
			source.integrations_config
		from public.business_location_configs as source
		where source.location_id = p_copy_from_location_id
		on conflict (location_id) do update set
			assistant_config = excluded.assistant_config,
			knowledge_config = excluded.knowledge_config,
			handoff_config = excluded.handoff_config,
			widget_config = excluded.widget_config,
			integrations_config = excluded.integrations_config,
			updated_at = now();
	else
		insert into public.business_location_configs as configs (location_id)
		values (v_location_id)
		on conflict (location_id) do nothing;
	end if;

	return query
	select
		locations.id,
		locations.business_id,
		locations.slug,
		locations.name,
		locations.address,
		p_copy_from_location_id
	from public.business_locations as locations
	where locations.id = v_location_id;
end;
$$;

revoke all on function public.create_business_location(text, text, uuid) from public;
grant execute on function public.create_business_location(text, text, uuid) to authenticated;

commit;
