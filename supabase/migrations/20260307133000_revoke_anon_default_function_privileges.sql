begin;

alter default privileges for role postgres in schema public
  revoke all on functions from anon;

commit;
