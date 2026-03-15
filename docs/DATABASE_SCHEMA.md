# Tandem Database Schema (Verified)

This file documents confirmed schema used by the current app.

Verification sources:
- migrations in `supabase/migrations/*`
- DB access in `apps/dashboard/src/app/api/**`
- DB access in `apps/dashboard/src/lib/website-import/store.ts`

No table/column below is inferred without source evidence.

## Source of Truth

- Active migration path for deploys: `supabase/migrations/*`
- Guardrail command: `npm run guard:migrations`

## Confirmed Tables

### `public.businesses`

Used by:
- `apps/dashboard/src/app/api/businesses/route.ts`

Confirmed columns:
- `id text` (PK)
- `name text`
- `slug text` (not null, unique index on `lower(slug)`)
- `created_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`
- `supabase/migrations/20260305032000_businesses_slug.sql`

### `public.business_memberships`

Used by:
- `apps/dashboard/src/app/api/location-config/route.ts`
- `apps/dashboard/src/app/api/website-import/start/route.ts`
- `apps/dashboard/src/lib/website-import/store.ts`

Confirmed columns:
- `id uuid` (PK)
- `business_id text` (FK -> `businesses.id`)
- `user_id uuid` (FK -> `auth.users.id`)
- `role text`
- `created_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`

### `public.business_locations`

Used by:
- `apps/dashboard/src/app/api/locations/route.ts`
- `apps/dashboard/src/app/api/location-config/route.ts`
- `apps/dashboard/src/app/api/chat/route.ts`
- website import routes under `apps/dashboard/src/app/api/website-import/**`

Confirmed columns:
- `id uuid` (PK)
- `business_id text` (FK -> `businesses.id`)
- `slug text` (unique with `business_id`)
- `name text`
- `address text`
- `created_by uuid` (FK -> `auth.users.id`)
- `created_at timestamptz`
- `website_url text`
- `last_import_run_id uuid` (FK -> `onboarding_import_runs.id`, nullable)

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`
- `supabase/migrations/20260304111500_website_import_runs.sql`

### `public.business_location_configs`

Used by:
- `apps/dashboard/src/app/api/location-config/route.ts`
- `apps/dashboard/src/app/api/chat/route.ts`
- `apps/dashboard/src/app/api/widget-theme/route.ts`
- `apps/dashboard/src/app/api/website-import/[runId]/apply/route.ts`

Confirmed columns:
- `location_id uuid` (PK/FK -> `business_locations.id`)
- `assistant_config jsonb`
- `knowledge_config jsonb`
- `handoff_config jsonb`
- `widget_config jsonb`
- `integrations_config jsonb`
- `updated_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`

### `public.chat_sessions`

Used by:
- `apps/dashboard/src/app/api/conversations/route.ts`
- `apps/dashboard/src/app/api/conversations/[sessionId]/route.ts`
- shared chat store paths in `packages/shared/src/storage/supabase.ts`

Confirmed columns:
- `id text` (PK)
- `business_id text` (FK -> `businesses.id`)
- `title text`
- `location_slug text` (added for location scope)
- `created_at timestamptz`
- `updated_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`
- `supabase/migrations/20260303042000_chat_session_location_scope.sql`

### `public.chat_messages`

Used by:
- `apps/dashboard/src/app/api/conversations/[sessionId]/route.ts`
- shared chat store paths in `packages/shared/src/storage/supabase.ts`

Confirmed columns:
- `id text` (PK)
- `session_id text` (FK -> `chat_sessions.id`)
- `business_id text` (FK -> `businesses.id`)
- `role text` (`user | assistant | system`)
- `content text`
- `created_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`

### `public.onboarding_import_runs`

Used by:
- `apps/dashboard/src/app/api/location/[locationId]/website-import/route.ts`
- `apps/dashboard/src/app/api/website-import/[runId]/route.ts`
- `apps/dashboard/src/app/api/website-import/[runId]/apply/route.ts`
- `apps/dashboard/src/lib/website-import/store.ts`
- `scripts/worker/website-import-worker.ts`

Confirmed columns:
- `id uuid` (PK)
- `location_id uuid` (FK -> `business_locations.id`)
- `url text`
- `status text` (`queued | running | succeeded | failed`)
- `error text`
- `error_code text`
- `pages_json jsonb`
- `signals_json jsonb`
- `result_json jsonb`
- `created_by uuid` (FK -> `auth.users.id`, nullable)
- `applied_by uuid` (FK -> `auth.users.id`, nullable)
- `started_at timestamptz`
- `finished_at timestamptz`
- `applied_at timestamptz`
- `created_at timestamptz`

Migration evidence:
- `supabase/migrations/20260304111500_website_import_runs.sql`
- `supabase/migrations/20260305010000_import_run_error_code.sql`

### `public.operator_profiles`

Confirmed columns:
- `user_id uuid` (PK/FK -> `auth.users.id`)
- `email text`
- `created_at timestamptz`

Migration evidence:
- `supabase/migrations/20260302022759_remote_schema.sql`

Current route usage in dashboard APIs is limited compared with tables above.

## Confirmed RPC Functions

Functions referenced in migrations and operationally relevant:
- `public.bootstrap_membership(text, text)`
- `public.create_business_location(text, text, uuid)`

Grant/revoke tightening evidence:
- `supabase/migrations/20260307120000_restore_create_business_location_rpc.sql`
- `supabase/migrations/20260307130000_tighten_rpc_grants.sql`

## Notes for Agents

- Do not assume additional columns on JSON payloads (`knowledge_config`, `widget_config`) beyond what code reads/writes.
- If you need to document more schema, derive from migrations and route queries first, then update this file.
