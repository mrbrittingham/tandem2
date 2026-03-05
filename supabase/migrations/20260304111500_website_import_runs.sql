create table if not exists public.onboarding_import_runs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.business_locations(id) on delete cascade,
  url text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  error text,
  pages_json jsonb not null default '[]'::jsonb,
  signals_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  applied_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_import_runs_location_created
  on public.onboarding_import_runs (location_id, created_at desc);

create index if not exists idx_onboarding_import_runs_status_created
  on public.onboarding_import_runs (status, created_at desc);

alter table public.business_locations
  add column if not exists website_url text;

alter table public.business_locations
  add column if not exists last_import_run_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_locations_last_import_run_id_fkey'
  ) then
    alter table public.business_locations
      add constraint business_locations_last_import_run_id_fkey
      foreign key (last_import_run_id)
      references public.onboarding_import_runs(id)
      on delete set null;
  end if;
end;
$$;

grant select, insert, update, delete on table public.onboarding_import_runs to authenticated;

alter table public.onboarding_import_runs enable row level security;

drop policy if exists onboarding_import_runs_select_member on public.onboarding_import_runs;
drop policy if exists onboarding_import_runs_insert_member on public.onboarding_import_runs;
drop policy if exists onboarding_import_runs_update_member on public.onboarding_import_runs;
drop policy if exists onboarding_import_runs_delete_member on public.onboarding_import_runs;

create policy onboarding_import_runs_select_member
on public.onboarding_import_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.business_locations as locations
    join public.business_memberships as memberships
      on memberships.business_id = locations.business_id
    where locations.id = onboarding_import_runs.location_id
      and memberships.user_id = auth.uid()
  )
);

create policy onboarding_import_runs_insert_member
on public.onboarding_import_runs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_locations as locations
    join public.business_memberships as memberships
      on memberships.business_id = locations.business_id
    where locations.id = onboarding_import_runs.location_id
      and memberships.user_id = auth.uid()
  )
);

create policy onboarding_import_runs_update_member
on public.onboarding_import_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.business_locations as locations
    join public.business_memberships as memberships
      on memberships.business_id = locations.business_id
    where locations.id = onboarding_import_runs.location_id
      and memberships.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.business_locations as locations
    join public.business_memberships as memberships
      on memberships.business_id = locations.business_id
    where locations.id = onboarding_import_runs.location_id
      and memberships.user_id = auth.uid()
  )
);

create policy onboarding_import_runs_delete_member
on public.onboarding_import_runs
for delete
to authenticated
using (
  exists (
    select 1
    from public.business_locations as locations
    join public.business_memberships as memberships
      on memberships.business_id = locations.business_id
    where locations.id = onboarding_import_runs.location_id
      and memberships.user_id = auth.uid()
  )
);