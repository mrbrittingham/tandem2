# Copilot instructions for Tandem monorepo

## Big picture architecture
- This is an npm workspaces monorepo with one Next.js app and two shared packages:
  - `apps/dashboard` (operator console, port 3100)
  - `packages/ui-kit` (embeddable `ChatWidget`)
  - `packages/shared` (domain types, mock store, server utilities)
- Keep backend logic in Next.js App Router route handlers (`src/app/api/**`) only. Do not add standalone servers/workers.
- Use `@tandem/shared` in client-safe code and `@tandem/shared/server` only in server code (route handlers/server contexts).

## Core data flows you should preserve
- Dashboard state is mock-first and browser-persistent:
  - `packages/shared/src/mock-store.ts` stores `MockState` in `localStorage` (`tandem:mock-state`), exposes subscribe/update helpers.
  - `apps/dashboard/src/lib/store-hooks.ts` binds that store with `useSyncExternalStore`.
- Widget configuration comes from business records:
  - `businessToWidgetConfig(...)` maps `BusinessProfile` -> `WidgetContentConfig` for preview and runtime.
- Chat flow is API-mediated and streaming:
  - `packages/ui-kit/src/ChatWidget.tsx` hydrates history via `GET /api/chat` then streams via `POST /api/chat`.
  - `apps/dashboard/src/app/api/chat/route.ts` persists user/assistant messages and proxies `llmStream(...)` output to the client.
- Conversation analytics in dashboard come from shared chat store routes:
  - `GET /api/conversations` and `GET /api/conversations/[sessionId]` in `apps/dashboard`.

## Server integration points
- LLM selection is env-driven in `packages/shared/src/llm/client.ts`:
  - `LLM_PROVIDER` defaults to `openai`.
  - `LLM_MODEL` defaults to `gpt-5.2`.
  - `OPENAI_API_KEY` is required for OpenAI provider.
  - Anthropic/Google providers are currently placeholders that throw.
- Supabase-backed auth/routes require:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Chat persistence is via `getChatStore()` in `packages/shared/src/storage/index.ts`:
  - Prefers file store (`packages/shared/src/storage/file.ts`) in `.data/` at repo root.
  - `TANDEM_DATA_DIR` overrides storage path.
  - Falls back to in-memory store if file store init fails.
- Session continuity uses `tandem_session` cookie in chat routes; message context is capped at 50 latest messages.

## Developer workflows
- Install deps: `npm install` (repo root).
- Main app dev loop (dashboard): `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Cleanup stale Next/Turbopack output: `npm run clean`.
- Supabase migrations are pushed from `supabase/migrations/*` via `supabase db push`.
- Avoid adding new production migrations only under `packages/shared/supabase/migrations/*`.
- Run `npm run guard:migrations` before schema pushes.
- There is currently no automated test suite in this repo; rely on typecheck/lint plus route/page verification.

## Project-specific coding conventions
- Business identity in UI/API flows commonly uses `business.slug` as `businessId`.
- Canonical chat/conversation scope is `businessId + locationSlug` across read/write paths.
- Prefer adding reusable contracts/utilities to `packages/shared` and presentation logic to `packages/ui-kit` rather than duplicating in apps.
- Keep App Router code consistent with existing patterns: `runtime = "nodejs"` for streaming chat routes, `NextResponse.json(...)` for JSON errors.