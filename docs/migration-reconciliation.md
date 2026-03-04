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

## Forward resolution rule

1. Add all new schema migrations only under `supabase/migrations/*`.
2. Run `npm run guard:migrations` before push/merge.
3. Never create additional SQL files under `packages/shared/supabase/migrations/*`.