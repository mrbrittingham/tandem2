begin;

create index if not exists idx_business_memberships_user_id
  on public.business_memberships (user_id);

create index if not exists idx_businesses_slug
  on public.businesses (slug);

create index if not exists idx_business_locations_business_created
  on public.business_locations (business_id, created_at desc);

commit;
