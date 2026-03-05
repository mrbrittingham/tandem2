begin;

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

commit;
