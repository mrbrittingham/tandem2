# Tandem Monorepo

Tandem is an npm workspaces monorepo for the operator dashboard, embeddable chat widget, and shared server/domain modules.

## Workspace layout

| Path | Purpose |
| --- | --- |
| `apps/dashboard` | Next.js App Router app (operator console + API routes, port 3100) |
| `packages/ui-kit` | `ChatWidget` and widget runtime config helpers |
| `packages/shared` | Shared types, mock store, LLM/provider routing, storage adapters, server helpers |
| `supabase` | Active Supabase CLI config + migration path used by `supabase db push` |

## Core architecture rules

- Backend logic stays in Next.js route handlers under `apps/dashboard/src/app/api/**`.
- Use `@tandem/shared` for client-safe imports and `@tandem/shared/server` for server-only code.
- Keep chat behavior aligned with the shared handlers used by `apps/dashboard/src/app/api/chat/route.ts`.
- Prefer shared domain logic in `packages/shared` and shared presentation logic in `packages/ui-kit`.

## Development commands

Run from repo root:

| Command | Description |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Start dashboard app on `http://localhost:3100` |
| `npm run lint` | Lint dashboard workspace |
| `npm run typecheck` | Type-check shared, ui-kit, and dashboard |
| `npm run build` | Build dashboard app |
| `npm run clean` | Remove stale `.next` and tsbuildinfo artifacts |

## Branch and deploy workflow

- `main` is production and the default branch for normal work.
- Pushes to `main` drive production deploys (Vercel app + Railway worker when configured).
- Use `wip/desktop-sync` only for large/unsafe changes or when explicitly requested.
- If a change adds `supabase/migrations/*`, run `npm run db:status` and `npm run db:push` for the target environment.

Website import identifier note:
- Website import routes accept `businessSlug` or opaque text `businessId` values (no UUID requirement).

## Environment quick reference

Required for authenticated dashboard flows:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for LLM generation:
- `OPENAI_API_KEY`

Optional:
- `LLM_PROVIDER` (default `openai`)
- `LLM_MODEL` (default `gpt-5.2`)
- `CHAT_STORE_DIR` (preferred file-store override path)
- `TANDEM_DATA_DIR`
- `TANDEM_API_KEY`
- `TANDEM_ALLOWED_BUSINESS_IDS`

Serverless note:
- Vercel runtime paths under `/var/task` are read-only. If Supabase chat storage is not configured, the file store automatically falls back to `/tmp/.tandem` in production/serverless.

## Documentation index

- Agent orientation: `AGENTS.md`
- Canonical architecture: `docs/architecture.md`
- Repo navigation index: `docs/REPO_INDEX.md`
- Verified DB schema reference: `docs/DATABASE_SCHEMA.md`
- System map: `docs/system-map.md`
- Current audit status: `docs/current-status.md`
- Stabilization priorities: `docs/stabilization-plan.md`
- Operational setup/run guide: `RUNBOOK.md`
- Migration reconciliation: `docs/migration-reconciliation.md`

## Migration guardrail

- Run `npm run guard:migrations` before pushing schema changes.
- New production migrations must exist only in `supabase/migrations/*`.
