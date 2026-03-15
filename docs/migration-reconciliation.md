# Migration Reconciliation Note

## Source of truth

- Authoritative migration folder: `supabase/migrations/*`
- Authoritative command path: `supabase db push` from repo root

## Historical folder (non-authoritative)

- `packages/shared/supabase/migrations/*` is retained for historical context only.
- New production SQL must not be added there.

## What exists today

### Root authoritative migrations
- `20260302022759_remote_schema.sql`
- `20260303042000_chat_session_location_scope.sql`
- `20260304111500_website_import_runs.sql`
- `20260305010000_import_run_error_code.sql`
- `20260305032000_businesses_slug.sql`

### Historical package migrations
- `0001_init.sql`
- `0002_auth_rls.sql`
- `0003_fix_bootstrap_membership_ambiguity.sql`
- `0004_locations.sql`
- `0005_chat_session_location_scope.sql`

## Confirmed overlap

- `supabase/migrations/20260303042000_chat_session_location_scope.sql`
- `packages/shared/supabase/migrations/0005_chat_session_location_scope.sql`

These two files are byte-identical and represent the same schema change (`chat_sessions.location_slug` + index).

## Baseline expectation

- `supabase/migrations/20260302022759_remote_schema.sql` is the baseline schema for clean environment replay.
- This file must define the core objects required by later root migrations (`businesses`, `chat_sessions`, `chat_messages`, `business_locations`, `business_location_configs`, `business_memberships`) plus baseline grants/RLS scaffolding.

## Forward resolution rule

1. Add all new schema migrations only under `supabase/migrations/*`.
2. Run `npm run guard:migrations` before push/merge.
3. Never create additional SQL files under `packages/shared/supabase/migrations/*`.