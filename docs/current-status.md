# Current Status Audit

Status reflects repository state as currently implemented.

## Working and verified

- Canonical chat pipeline is unified on `GET/POST /api/chat` and used by `ChatWidget`.
- Conversation list/detail APIs support `businessId` + `locationSlug` scoping.
- Legacy compatibility fallback exists when `location_slug` data is missing.
- Dashboard conversations page includes hydration-safe rendering and summary visualizations.
- Auth guard flow is present (middleware gate + `/login` + API `401`).
- Supabase-backed storage path exists and file/in-memory fallbacks are implemented.
- Root Supabase migrations include remote schema baseline and location-scope chat migration.

## Broken, inconsistent, or incomplete

- Provider support is incomplete: Anthropic/Google providers are stubs that throw "Provider not yet implemented".
- Conversation analytics are partial: average response time card is hardcoded as TODO in UI.
- Migration source-of-truth is split:
  - CLI push uses `supabase/migrations/*`.
  - Additional historical migrations also exist at `packages/shared/supabase/migrations/*`.
- `.env.example` is now aligned with required auth and LLM variables, but runtime startup checks are still minimal.
- Documentation is improved with agent orientation, architecture, schema, and repo index references, but should be kept current with future flow changes.

## Risks and footguns

- If Supabase env vars are missing, most authenticated console APIs fail at runtime.
- If root migrations are not used for push, schema drift can occur between expected code paths and deployed DB schema.
- Debug endpoint `/api/debug/env` intentionally exposes environment diagnostics in non-production; should remain gated.
- Location scoping depends on both code and migration rollout; partial rollout can produce confusing data visibility until fallbacks are removed.

## Confidence notes

- Claims above are based on direct inspection of route handlers, shared storage/LLM/auth modules, and current migration folders.
- No automated test suite exists; confidence relies on lint/typecheck and route-level behavior checks.

## Direction callouts

- Website import is now structured-knowledge-first (classification -> extraction -> review/apply), with FAQ output treated as secondary when structured restaurant data is available.

## Root cause + fix (chat/conversations)

- Root cause: `/api/chat` writes through shared `getChatStore`, while `/api/conversations` required Supabase-authenticated reads; this made local verification brittle and could mask pipeline/scope drift.
- Root cause: scope derivation was duplicated across pages (`businessSlug/slug` and `locationSlug/slug`), increasing the chance of location mismatches.
- Fix: added canonical scope resolver in dashboard (`resolveChatScope`) and used it where chat scope is derived for preview/runtime and conversations.
- Fix: added hard-gated dev-only smoke bypass (`DEV_SMOKE=1` + `x-dev-smoke: 1`) for chat/conversations so local smoke checks run without copied cookies/tokens and still enforce `businessId + locationSlug`.
- Fix: stabilized conversations location label hydration by rendering a mount-safe placeholder until client state is ready.
