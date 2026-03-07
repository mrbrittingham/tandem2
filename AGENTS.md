# Tandem Agent Guide

This file is the fast-start orientation for AI coding agents working in this repo.

## What Tandem Is

Tandem is a restaurant-focused operator platform with:
- a dashboard app (`apps/dashboard`) for setup, knowledge, handoff, and operations
- an embeddable chat widget (`packages/ui-kit`)
- shared domain/server utilities (`packages/shared`)

## Product Direction (Repository Intent)

- Restaurant-first workflows are the default.
- Website import is classification-first, then extraction.
- Structured restaurant knowledge is preferred over FAQ-only generation when structured data exists.
- Chat runtime should prioritize imported structured knowledge before generic assumptions.

## Monorepo Boundaries

- Keep backend logic in Next.js App Router API routes: `apps/dashboard/src/app/api/**`.
- Use `@tandem/shared` in client-safe code.
- Use `@tandem/shared/server` only in server contexts.
- Put reusable domain logic in `packages/shared`, not duplicated in app routes/pages.

## Core Subsystems

- Website import pipeline:
  - API queue + read/apply routes under `apps/dashboard/src/app/api/website-import/**`
  - import core logic under `apps/dashboard/src/lib/website-import/**`
  - async worker at `scripts/worker/website-import-worker.ts`
- Knowledge authoring UI:
  - `apps/dashboard/src/app/(console)/knowledge/page.tsx`
  - `apps/dashboard/src/components/WebsiteImportPanel.tsx`
- Chat runtime:
  - `apps/dashboard/src/app/api/chat/route.ts`
  - shared handlers in `packages/shared/src/server/**`

## Agent Context Loading Strategy

Read only what you need before editing.

## How Agents Should Start Work In This Repo

Use this order before code edits:

1. Read `AGENTS.md`.
2. Read `docs/architecture.md`.
3. Read `docs/REPO_INDEX.md`.
4. Then read only the relevant module files for the task.
5. For DB-facing work, also read `docs/DATABASE_SCHEMA.md` before changing code.

Use targeted file reads (`rg` + specific files) before broad repo scans.

## Non-Negotiables

- Do not invent tables, columns, APIs, or architecture.
- Do not replace structured knowledge paths with FAQ-first shortcuts.
- Preserve canonical scope in chat/conversations: `businessId + locationSlug`.
- Keep migration source of truth under `supabase/migrations/*`.
