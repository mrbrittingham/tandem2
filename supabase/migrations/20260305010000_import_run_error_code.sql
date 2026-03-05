alter table public.onboarding_import_runs
  add column if not exists error_code text;

create index if not exists idx_onboarding_import_runs_error_code
  on public.onboarding_import_runs (error_code)
  where error_code is not null;
