-- Location System Audit + Cleanup Script
-- Run read-only sections first. Keep writes in a transaction and review affected rows.

-- 1) Canonical table snapshots
select id, name, slug, created_at
from public.businesses
order by created_at desc;

select id, business_id, user_id, role, created_at
from public.business_memberships
order by created_at desc;

select id, business_id, slug, name, address, created_by, created_at
from public.business_locations
order by created_at desc;

select location_id, updated_at,
			 knowledge_config -> 'businessProfile' ->> 'phone' as phone,
			 knowledge_config -> 'businessProfile' ->> 'timezone' as timezone,
			 knowledge_config -> 'businessProfile' ->> 'locationName' as legacy_location_name,
			 knowledge_config -> 'businessProfile' ->> 'address' as legacy_address
from public.business_location_configs
order by updated_at desc nulls last;

-- 2) Integrity checks
-- 2.1 locations without configs
select l.id, l.business_id, l.slug, l.name, l.address, l.created_at
from public.business_locations l
left join public.business_location_configs c on c.location_id = l.id
where c.location_id is null
order by l.created_at desc;

-- 2.2 orphan configs
select c.location_id
from public.business_location_configs c
left join public.business_locations l on l.id = c.location_id
where l.id is null;

-- 2.3 duplicate slugs (should be empty due unique constraint)
select business_id, slug, count(*)
from public.business_locations
group by business_id, slug
having count(*) > 1;

-- 2.4 likely duplicate locations by normalized name+address
with normalized as (
	select id,
				 business_id,
				 lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g')) as name_key,
				 lower(regexp_replace(coalesce(address, ''), '[^a-z0-9]+', '', 'g')) as address_key,
				 slug,
				 name,
				 address,
				 created_at
	from public.business_locations
)
select business_id, name_key, address_key, count(*) as dup_count,
			 array_agg(id order by created_at desc) as ids
from normalized
where name_key <> ''
group by business_id, name_key, address_key
having count(*) > 1
order by dup_count desc;

-- 2.5 legacy config artifacts we no longer want to persist
select location_id,
			 knowledge_config -> 'businessProfile' ->> 'locationName' as legacy_location_name,
			 knowledge_config -> 'businessProfile' ->> 'address' as legacy_address
from public.business_location_configs
where coalesce(knowledge_config -> 'businessProfile' ->> 'locationName', '') <> ''
	 or coalesce(knowledge_config -> 'businessProfile' ->> 'address', '') <> '';

-- 3) Non-destructive normalization preview
-- Keep newest location per normalized name/address and mark older duplicates for removal.
with normalized as (
	select id,
				 business_id,
				 lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g')) as name_key,
				 lower(regexp_replace(coalesce(address, ''), '[^a-z0-9]+', '', 'g')) as address_key,
				 created_at
	from public.business_locations
), ranked as (
	select *,
				 row_number() over (
					 partition by business_id, name_key, address_key
					 order by created_at desc, id desc
				 ) as rn
	from normalized
)
select *
from ranked
where rn > 1
order by business_id, name_key, address_key, created_at desc;

-- 4) Cleanup write plan (execute only after reviewing section 3)
-- begin;
--
-- 4.1 Delete duplicate location configs for duplicate rows (keep rn=1 rows)
-- with normalized as (
--   select id,
--          business_id,
--          lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g')) as name_key,
--          lower(regexp_replace(coalesce(address, ''), '[^a-z0-9]+', '', 'g')) as address_key,
--          created_at
--   from public.business_locations
-- ), ranked as (
--   select id,
--          row_number() over (
--            partition by business_id, name_key, address_key
--            order by created_at desc, id desc
--          ) as rn
--   from normalized
-- )
-- delete from public.business_location_configs c
-- where c.location_id in (select id from ranked where rn > 1);
--
-- 4.2 Delete duplicate location rows
-- with normalized as (
--   select id,
--          business_id,
--          lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g')) as name_key,
--          lower(regexp_replace(coalesce(address, ''), '[^a-z0-9]+', '', 'g')) as address_key,
--          created_at
--   from public.business_locations
-- ), ranked as (
--   select id,
--          row_number() over (
--            partition by business_id, name_key, address_key
--            order by created_at desc, id desc
--          ) as rn
--   from normalized
-- )
-- delete from public.business_locations l
-- where l.id in (select id from ranked where rn > 1);
--
-- 4.3 Remove legacy config keys (keep phone/timezone)
-- update public.business_location_configs
-- set knowledge_config = jsonb_set(
--   jsonb_set(coalesce(knowledge_config, '{}'::jsonb), '{businessProfile,locationName}', 'null'::jsonb, true),
--   '{businessProfile,address}',
--   'null'::jsonb,
--   true
-- );
--
-- commit;

