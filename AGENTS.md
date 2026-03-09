# Tandem Agent Guide

This file is the comprehensive orientation for AI coding agents working in this monorepo.

---

## 1. Project Overview

Tandem is a restaurant-focused operator platform providing:
- **Dashboard** (`apps/dashboard`) — Next.js App Router console for setup, knowledge authoring, handoff configuration, conversation analytics, and widget customization (port 3100).
- **Embeddable Chat Widget** (`packages/ui-kit`) — `ChatWidget` component + full design system primitives (buttons, inputs, overlays, layout, data display, workflow).
- **Shared Domain Logic** (`packages/shared`) — Types, mock store, LLM clients, chat storage, auth guards, and server utilities.

Product direction: restaurant-first workflows, structured knowledge over FAQ-only, classification-first website import, LLM chat grounded in imported knowledge.

---

## 2. Architecture Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| Dashboard App | `apps/dashboard` | Next.js 16 App Router operator console |
| UI Kit | `packages/ui-kit` | Embeddable ChatWidget + design system |
| Shared | `packages/shared` | Domain types, mock store, client-safe utilities |
| Shared/Server | `packages/shared/src/server/` | LLM, storage, auth, chat-handler (server-only) |
| Worker | `scripts/worker/website-import-worker.ts` | Async import processor |
| Database | `supabase/migrations/` | Authoritative PostgreSQL schema |

### Data flow summary

- **Chat**: `ChatWidget` → `GET /api/chat` (hydrate) → `POST /api/chat` (stream) → `handleChatPost()` → `llmStream()` → persist via `getChatStore()`
- **Website import**: queue via API → worker polls DB → crawl + classify + extract → structured draft → operator review → apply to location config
- **Dashboard state**: `MockState` in `localStorage` (`tandem:mock-state`), bound to React via `useSyncExternalStore`
- **Canonical scope**: `businessId + locationSlug` pair across all read/write paths

---

## 3. Repository Structure

```
tandem/
├── apps/dashboard/             Next.js operator console
│   └── src/
│       ├── app/
│       │   ├── (console)/      Page routes (overview, knowledge, conversations, etc.)
│       │   ├── api/            REST API route handlers
│       │   ├── login/          Auth entry
│       │   └── onboarding/     New-user flow
│       ├── components/         Dashboard-specific UI
│       └── lib/                Hooks, utilities, website-import logic
├── packages/shared/            Domain types + server utilities
│   └── src/
│       ├── client/             Client-safe exports
│       ├── llm/                LLM provider abstraction
│       ├── server/             Server-only exports (auth, chat-handler, guardrails)
│       ├── storage/            Chat persistence (Supabase, file, memory)
│       └── supabase/           Client factories
├── packages/ui-kit/            ChatWidget + design system
│   └── src/
│       ├── primitives/         Button, Input, Select, etc.
│       ├── data/               Table, StatCard, ActivityFeed
│       ├── feedback/           Skeleton, Spinner, Toaster
│       ├── layout/             AppShell, Sidebar, Topbar, PageContainer
│       ├── overlay/            Dialog, Popover, DropdownMenu, Tooltip
│       ├── workflow/           Stepper, StatusPill, LogList
│       └── tokens/             CSS design tokens
├── scripts/                    Dev, deploy, migration helpers
│   ├── worker/                 website-import-worker.ts
│   └── guard/                  Migration & schema guards
├── supabase/migrations/        Authoritative SQL migrations
├── docs/                       Architecture & operational docs
│   └── product/                Product UX audits (manually maintained)
└── .github/                    CI workflows + copilot instructions
```

---

## 4. File Reading Strategy for AI Agents

### Context loading order

1. Read `AGENTS.md` (this file).
2. Read `docs/repo-map.md` for full directory + entrypoint reference.
3. Read `docs/REPO_INDEX.md` for quick navigation of high-value code areas.
4. Then read **only** the relevant module files for the task.
5. For DB-facing work, also read `docs/DATABASE_SCHEMA.md` before changing code.

### Efficient scanning

- Use targeted file reads (`rg` for exact strings + specific files) before broad repo scans.
- Read `packages/shared/src/types.ts` for domain type definitions.
- Read `packages/shared/src/server/index.ts` to see all server exports.
- For API route patterns, read one existing route (e.g., `api/chat/route.ts`) as a template.

---

## 5. UI Design System Rules

### Token hierarchy

| File | Scope |
|------|-------|
| `packages/ui-kit/src/tokens/` | Shared design tokens |
| `packages/ui-kit/src/tandem-widget-tokens.css` | Widget CSS custom properties |
| `apps/dashboard/src/app/tandem-console-tokens.css` | Console CSS custom properties |
| `apps/dashboard/src/app/globals.css` | Global styles + Tailwind 4 |

### Component reuse

- Use `packages/ui-kit` primitives (Button, Input, Select, etc.) in both dashboard and widget contexts.
- Dashboard-specific components live in `apps/dashboard/src/components/`.
- Widget-specific layout uses CSS Modules (`ChatWidget.module.css`).
- Theme customization flows through `ThemeTokens` type → CSS custom properties.

### Rules

- Do not duplicate primitives from `packages/ui-kit` in `apps/dashboard`.
- Use Radix UI wrappers from `packages/ui-kit/src/overlay/` for dialogs/popovers.
- Console styling uses Tailwind classes; widget styling uses CSS Modules + tokens.

---

## 6. Safe Editing Guidelines

### Monorepo boundaries

- Keep backend API logic in Next.js App Router route handlers: `apps/dashboard/src/app/api/**`.
- Use `@tandem/shared` in client-safe code.
- Use `@tandem/shared/server` **only** in server contexts (route handlers, server components).
- Put reusable domain logic in `packages/shared`, not duplicated in app routes/pages.

### Do not

- Invent new tables, columns, APIs, or architectural layers.
- Replace structured knowledge paths with FAQ-first shortcuts.
- Add new standalone servers or workers (the website-import worker is the approved exception).
- Modify files in `docs/product/` via automation — these are manually maintained.

### Do

- Follow existing patterns for API routes: `runtime = "nodejs"` for streaming, `NextResponse.json()` for errors.
- Use `business.slug` as `businessId` in UI/API flows.
- Scope chat/conversation queries by `businessId + locationSlug`.
- Run `npm run typecheck` and `npm run lint` after changes.

---

## 7. Supabase Database Rules

### Authoritative migration path

All migrations live in `supabase/migrations/`. Legacy migrations under `packages/shared/supabase/migrations/` are NOT the active push path.

### Before any schema change

1. Read `docs/DATABASE_SCHEMA.md`.
2. Run `npm run guard:migrations` to verify no migrations exist outside the authoritative path.
3. Create new migrations via `npm run migration:new -- <name>`.
4. Push to remote via `npm run db:push`.

### Core tables

| Table | Scope |
|-------|-------|
| `businesses` | Business entities (id, name, slug) |
| `business_locations` | Locations per business |
| `business_location_configs` | JSONB config blobs (assistant, knowledge, handoff, widget, integrations) |
| `chat_sessions` | Scoped by businessId + locationSlug |
| `chat_messages` | Individual messages (user/assistant/system) |
| `onboarding_import_runs` | Website import job tracking |
| `business_memberships` | User-business role assignments |
| `operator_profiles` | Auth user metadata |

### Storage fallback chain

1. Supabase → 2. File store (`.data/`) → 3. In-memory

---

## 8. Dashboard Development Patterns

### Adding a new console page

1. Create `apps/dashboard/src/app/(console)/<route>/page.tsx`.
2. Follow existing page patterns (imports from `@tandem/ui-kit`, `@tandem/shared`).
3. Add sidebar entry in `apps/dashboard/src/components/ConsoleSidebar.tsx`.
4. Use `useSyncExternalStore` binding via `store-hooks.ts` for mock-first state.

### Adding a new API route

1. Create `apps/dashboard/src/app/api/<path>/route.ts`.
2. Export named functions: `GET`, `POST`, etc.
3. For streaming: set `export const runtime = "nodejs"`.
4. Validate scope: require `businessId` + `locationSlug` where applicable.
5. Return errors via `NextResponse.json({ error: "..." }, { status: N })`.

### Widget configuration flow

`BusinessProfile` → `businessToWidgetConfig()` → `WidgetContentConfig` → `ChatWidget` props.

---

## 9. Crawler & Ingestion Architecture

### Pipeline stages

1. **Queue**: `POST /api/website-import/start` creates `onboarding_import_runs` row (status: `queued`).
2. **Poll**: `scripts/worker/website-import-worker.ts` polls every 5s for `queued` rows.
3. **Claim**: Atomic `queued → running` update.
4. **Crawl**: `crawlWebsite()` — fetch HTML, classify pages, extract signals (emails, hours, addresses).
5. **Extract**: LLM-assisted structured knowledge generation.
6. **Store**: Result JSON saved to import run record (status: `succeeded`).
7. **Review**: Operator reviews draft in Knowledge UI.
8. **Apply**: `POST /api/website-import/:runId/apply` merges draft into `business_location_configs`.

### Key files

| File | Purpose |
|------|---------|
| `scripts/worker/website-import-worker.ts` | Async poll + process loop |
| `apps/dashboard/src/lib/website-import/` | Crawl, classify, extract, schema |
| `apps/dashboard/src/components/WebsiteImportPanel.tsx` | Import UI |
| `apps/dashboard/src/app/(console)/knowledge/page.tsx` | Knowledge editor |

---

## 10. AI Agent Workflow Recommendations

### Starting a task

1. Read this file + `docs/repo-map.md`.
2. Identify the subsystem affected.
3. Read only the relevant source files.
4. Check `docs/DATABASE_SCHEMA.md` if the task touches persistence.

### Making changes

- Follow existing patterns — read a nearby file as a template before writing new code.
- Run `npm run typecheck` after edits to validate.
- Keep changes minimal and focused on the requested task.
- Test via `npm run dev` for UI changes, `npm run smoke:chat` for chat changes.

### Pull request / commit scope

- One subsystem per commit when possible.
- Reference file paths in commit messages for navigability.

---

## 11. Context Window Optimization Strategies

- **Start narrow**: Read `AGENTS.md` + `docs/repo-map.md` (~600 lines total) instead of scanning the whole repo.
- **Use the type file**: `packages/shared/src/types.ts` defines all domain types — read it once.
- **Index files are exports maps**: Read `index.ts` files to understand module surfaces without reading every source file.
- **API routes are self-contained**: Each route handler file contains its full request/response contract.
- **Targeted search**: Use `rg` with exact function/type names before doing broad searches.
- **Batch reads**: Read related files together rather than one at a time.
- **Skip `node_modules`**: All workspace dependencies are importable; don't explore their source.

---

## Non-Negotiables

- Do not invent tables, columns, APIs, or architecture.
- Do not replace structured knowledge paths with FAQ-first shortcuts.
- Preserve canonical scope in chat/conversations: `businessId + locationSlug`.
- Keep migration source of truth under `supabase/migrations/*`.
- Do not modify files in `docs/product/` via automation.
