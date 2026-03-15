begin;

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

grant select, insert, update, delete on table public.business_locations to authenticated;
grant select, insert, update, delete on table public.business_location_configs to authenticated;

alter table public.business_locations enable row level security;
alter table public.business_location_configs enable row level security;

drop policy if exists business_locations_select_member on public.business_locations;
drop policy if exists business_locations_insert_member on public.business_locations;
drop policy if exists business_locations_update_member on public.business_locations;
drop policy if exists business_locations_delete_member on public.business_locations;
drop policy if exists business_location_configs_select_member on public.business_location_configs;
drop policy if exists business_location_configs_insert_member on public.business_location_configs;
drop policy if exists business_location_configs_update_member on public.business_location_configs;
drop policy if exists business_location_configs_delete_member on public.business_location_configs;

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
