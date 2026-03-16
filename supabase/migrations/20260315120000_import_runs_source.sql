-- Phase 1 (Tandem 3.0): Add source column to onboarding_import_runs
-- Tracks whether a run was triggered from the knowledge page or the onboarding flow.
-- Default is 'knowledge-page' for backward compatibility with existing rows.

alter table public.onboarding_import_runs
  add column if not exists source text not null default 'knowledge-page';

create index if not exists idx_onboarding_import_runs_source
  on public.onboarding_import_runs (source);
