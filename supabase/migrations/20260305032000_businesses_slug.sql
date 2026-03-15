alter table public.businesses
  add column if not exists slug text;

with base as (
  select
    id,
    coalesce(nullif(trim(name), ''), 'business') as name_value
  from public.businesses
), normalized as (
  select
    id,
    trim(both '-' from regexp_replace(lower(name_value), '[^a-z0-9]+', '-', 'g')) as base_slug
  from base
), finalized as (
  select
    id,
    case
      when base_slug = '' then 'business'
      else base_slug
    end as base_slug
  from normalized
)
update public.businesses as businesses
set slug = case
  when finalized.base_slug = '' then 'business-' || left(replace(businesses.id::text, '-', ''), 8)
  else finalized.base_slug
end
from finalized
where businesses.id = finalized.id
  and (businesses.slug is null or businesses.slug = '');

with ranked as (
  select
    id,
    slug,
    row_number() over (partition by lower(slug) order by id) as rank
  from public.businesses
)
update public.businesses as businesses
set slug = businesses.slug || '-' || left(replace(businesses.id::text, '-', ''), 8)
from ranked
where businesses.id = ranked.id
  and ranked.rank > 1;

update public.businesses
set slug = lower(slug)
where slug <> lower(slug);

alter table public.businesses
  alter column slug set not null;

create unique index if not exists idx_businesses_slug_unique
  on public.businesses (lower(slug));
