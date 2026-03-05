begin;

alter table public.chat_sessions
  add column if not exists location_slug text;

create index if not exists idx_chat_sessions_business_location_updated
  on public.chat_sessions (business_id, location_slug, updated_at desc);

commit;
