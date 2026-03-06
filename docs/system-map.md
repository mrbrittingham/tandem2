# Tandem System Map (Current)

This document describes what is actually running in this repo today.

## Monorepo layout

- `apps/dashboard`: Next.js App Router app (operator console + API surface).
- `packages/shared`: cross-app types, mock store, LLM client/provider routing, storage adapters, server chat/auth helpers.
- `packages/ui-kit`: embeddable `ChatWidget` and runtime config resolver.
- `supabase/`: active Supabase CLI project config + authoritative migration folder for `supabase db push`.

## Runtime architecture

```text
Browser (dashboard console, widget preview)
  -> Next.js app routes (apps/dashboard/src/app/**)
  -> API routes (apps/dashboard/src/app/api/**)
      -> @tandem/shared/server chat + auth helpers
      -> @tandem/shared llm client
      -> @tandem/shared storage adapter selection
          -> Supabase chat store (preferred when env configured)
          -> file store in .data/ (fallback)
          -> in-memory store (last-resort fallback)
```

## Core APIs and flows

### Scope Contract

Canonical scope key is the pair `(businessId, locationSlug)`.

- `businessId`: business-level scope (typically business slug).
- `locationSlug`: location-level scope within the business.

#### Canonical request shapes

- Chat hydrate: `GET /api/chat?businessId=<businessId>&locationSlug=<locationSlug>`
- Chat send: `POST /api/chat` body includes `{ businessId, locationSlug, messages }`
- Conversations list: `GET /api/conversations?businessId=<businessId>&locationSlug=<locationSlug>`
- Conversation detail: `GET /api/conversations/<sessionId>?businessId=<businessId>&locationSlug=<locationSlug>`

#### Scope application map (read/write entry points)

- `packages/ui-kit/src/ChatWidget.tsx`
  - Hydration uses scoped `GET /api/chat`.
  - Send uses scoped `POST /api/chat` payload.
- `apps/dashboard/src/app/api/chat/route.ts`
  - Enforces both scope fields (`businessId`, `locationSlug`) before delegating shared chat handlers.
- `packages/shared/src/server/chat-handler.ts`
  - Uses both scope fields for session matching/creation and response payload.
- `apps/dashboard/src/app/api/conversations/route.ts`
  - Lists sessions by `business_id + location_slug`.
- `apps/dashboard/src/app/api/conversations/[sessionId]/route.ts`
  - Resolves detail by `sessionId + business_id + location_slug`.
- `apps/dashboard/src/app/(console)/conversations/page.tsx`
  - Sends both scope fields for list and detail requests.

#### Legacy fallback status

- Legacy fallback paths remain enabled for environments missing `chat_sessions.location_slug`.
- Fallback usage is now explicitly logged in non-production environments (`[scope-fallback]`).

### Auth and console access
- Route guard is in `apps/dashboard/src/middleware.ts`.
- Unauthenticated page requests redirect to `/login`; API requests return `401`.
- Supabase session refresh and user extraction are handled by `apps/dashboard/src/lib/supabase/middleware.ts`.

### Chat (canonical)
- Widget calls `GET /api/chat` for history hydration.
- Widget calls `POST /api/chat` for streaming assistant responses.
- Route implementation lives at `apps/dashboard/src/app/api/chat/route.ts`, which delegates to `@tandem/shared/server`.
- Session continuity is managed via `tandem_session` cookie; context is capped to recent messages.

### Conversations
- `GET /api/conversations`: list + summary by `businessId` and optional `locationSlug`.
- `GET /api/conversations/[sessionId]`: detail view with scoped lookup.
- Both include compatibility fallback behavior for legacy rows where `location_slug` may be absent.

### Business/location bootstrap and theme
- `POST /api/bootstrap`: initializes membership for the authenticated user.
- `GET /api/businesses`: lists businesses.
- `GET/POST /api/locations`: list/create business locations.
- `GET/POST /api/widget-theme`: load/save location-scoped widget theme.

### Health and diagnostics
- `GET /api/health`: simple liveness check.
- `GET/POST /api/llm-test`: provider/model/key visibility and generation smoke test.
- `GET /api/debug/env`: non-production env diagnostics endpoint.

## Persistence and schema

- Chat store selection is in `packages/shared/src/storage/index.ts`.
- Supabase adapter: `packages/shared/src/storage/supabase.ts`.
- File adapter: `packages/shared/src/storage/file.ts` (default path `.data/` in local dev, override with `CHAT_STORE_DIR` or `TANDEM_DATA_DIR`; in production/serverless it auto-falls back to `/tmp/.tandem` when a repo-local path would be used).
- Active migration source for CLI push: `supabase/migrations/*`.
- A second migration path exists in `packages/shared/supabase/migrations/*` and is not automatically pushed by default CLI commands.

## Environment dependencies

### Required for authenticated console + Supabase data path
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Required for LLM generation/streaming (OpenAI path)
- `OPENAI_API_KEY`

### Optional behavior flags
- `LLM_PROVIDER` (default `openai`)
- `LLM_MODEL` (default `gpt-5.2`)
- `CHAT_STORE_DIR`
- `TANDEM_DATA_DIR`
- `TANDEM_API_KEY`
- `TANDEM_ALLOWED_BUSINESS_IDS`
