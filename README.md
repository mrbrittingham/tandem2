# Tandem 2.0 Monorepo

Tandem 2.0 is the next-generation concierge chatbot experience plus future dashboard tooling, all managed inside a single npm workspaces repo. Every backend interaction must live inside Next.js App Router route handlers under `apps/chatbot/app/api/*`; no Express servers or ad-hoc runtimes are allowed.

## Structure
| Path | Purpose |
| --- | --- |
| `apps/chatbot` | Customer-facing widget host (Next.js App Router) |
| `apps/dashboard` | Reserved for upcoming operator UI |
| `packages/shared` | Cross-cutting TypeScript types/utilities |
| `packages/ui-kit` | React components consumed by Tandem surfaces |
| `supabase/` | Backend schema + migrations (future) |
| `docs/` | Additional architecture notes (future) |

## Commands
Run everything from the repo root:

| Command | Description |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Start the chatbot dev server |
| `npm run lint` | Lint chatbot via Next/ESLint |
| `npm run typecheck` | Type-check shared, UI kit, and chatbot workspaces |
| `npm --workspace apps/chatbot run build` | Production build of the chatbot |

## Working Agreements
- Favor shared packages over duplicating logic inside apps.
- Keep UI primitives in `packages/ui-kit`; keep types in `packages/shared`.
- Only Next.js route handlers (`apps/chatbot/app/api/*`) may implement backend logic.
- Avoid destructive refactors; land changes in small, verifiable increments.
