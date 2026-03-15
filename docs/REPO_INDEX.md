# Tandem Repo Index

Quick navigation map for high-value code areas.

## Agent Orientation

- `AGENTS.md`
- `.agent-instructions.md`
- `.github/copilot-instructions.md`
- `README.md`

## Architecture Docs

- `docs/architecture.md`
- `docs/system-map.md`
- `docs/DATABASE_SCHEMA.md`
- `RUNBOOK.md`

## Dashboard App (Next.js)

- App shell and console pages:
  - `apps/dashboard/src/app/(console)/layout.tsx`
  - `apps/dashboard/src/app/(console)/knowledge/page.tsx`
  - `apps/dashboard/src/app/(console)/handoff/page.tsx`
  - `apps/dashboard/src/app/(console)/widget/page.tsx`
  - `apps/dashboard/src/app/(console)/appearance/page.tsx`
  - `apps/dashboard/src/app/(console)/settings/page.tsx`

- API routes (primary backend surface):
  - `apps/dashboard/src/app/api/chat/route.ts`
  - `apps/dashboard/src/app/api/conversations/route.ts`
  - `apps/dashboard/src/app/api/conversations/[sessionId]/route.ts`
  - `apps/dashboard/src/app/api/location-config/route.ts`
  - `apps/dashboard/src/app/api/widget-theme/route.ts`

## Website Import System

- UI integration:
  - `apps/dashboard/src/components/WebsiteImportPanel.tsx`

- Import APIs:
  - `apps/dashboard/src/app/api/website-import/start/route.ts`
  - `apps/dashboard/src/app/api/website-import/latest/route.ts`
  - `apps/dashboard/src/app/api/website-import/[runId]/route.ts`
  - `apps/dashboard/src/app/api/website-import/[runId]/apply/route.ts`
  - `apps/dashboard/src/app/api/location/[locationId]/website-import/route.ts`
  - `apps/dashboard/src/app/api/website-import/schema-check/route.ts`

- Import core library:
  - `apps/dashboard/src/lib/website-import/types.ts`
  - `apps/dashboard/src/lib/website-import/schema.ts`
  - `apps/dashboard/src/lib/website-import/crawl.ts`
  - `apps/dashboard/src/lib/website-import/extract.ts`
  - `apps/dashboard/src/lib/website-import/apply.ts`
  - `apps/dashboard/src/lib/website-import/run.ts`
  - `apps/dashboard/src/lib/website-import/store.ts`

- Import worker:
  - `scripts/worker/website-import-worker.ts`

## Knowledge and Prompting

- Knowledge program model:
  - `apps/dashboard/src/lib/knowledge-program.ts`

- Chat runtime prompt assembly:
  - `apps/dashboard/src/app/api/chat/route.ts`

## Shared Packages

- `packages/shared/src/index.ts`
- `packages/shared/src/types.ts`
- `packages/shared/src/mock-store.ts`
- `packages/shared/src/llm/client.ts`
- `packages/shared/src/server/chat-handler.ts`
- `packages/shared/src/storage/index.ts`
- `packages/shared/src/storage/supabase.ts`
- `packages/shared/src/storage/file.ts`

- `packages/ui-kit/src/ChatWidget.tsx`
- `packages/ui-kit/src/runtime-config.ts`

## Supabase and Migrations

- Active migration path:
  - `supabase/migrations/`

- Guard + helpers:
  - `scripts/guard/supabase-schema-guard.mjs`
  - `scripts/guard-migrations.mjs`
  - `scripts/supabase-link.mjs`
  - `scripts/supabase-push.mjs`
  - `scripts/supabase-status.mjs`

## Verification Commands

Run from repo root:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run guard:migrations`
