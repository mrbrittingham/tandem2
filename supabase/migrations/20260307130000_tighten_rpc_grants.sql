begin;

revoke all on function public.bootstrap_membership(text, text) from anon;
revoke all on function public.create_business_location(text, text, uuid) from anon;

grant execute on function public.bootstrap_membership(text, text) to authenticated;
grant execute on function public.create_business_location(text, text, uuid) to authenticated;

revoke all on function public.set_business_name_default() from anon;
revoke all on function public.tandem_set_updated_at() from anon;

grant execute on function public.set_business_name_default() to authenticated;
grant execute on function public.tandem_set_updated_at() to authenticated;

commit;
