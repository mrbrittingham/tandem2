# Tandem 2.0 Monorepo

Tandem 2.0 houses the concierge chatbot experience (and the shared UI kit that powers it) inside a single npm workspaces repository. The goal is to iterate quickly on the embedded widget while guaranteeing that every server interaction still runs through the Next.js App Router.

## Structure
| Path | Purpose |
| --- | --- |
| `apps/chatbot` | Next.js surface that hosts the widget preview and API routes |
| `packages/ui-kit` | Themeable React components consumed by the chatbot |
| `packages/shared` | Cross-cutting TypeScript contracts/utilities |

## Commands (run from repo root)
| Command | Description |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Start `apps/chatbot` on http://localhost:3000 |
| `npm run lint` | Lint the chatbot workspace |
| `npm run typecheck` | Type-check shared, UI kit, and chatbot packages |
| `npm run build` | Production build of the chatbot app |
| `npm run clean` | Remove `.next` output and stray `*.tsbuildinfo` files |

If the dev server refuses to start or Turbopack leaves a stale lock behind, run `npm run clean` and re-run `npm run dev`.

## Backend guardrails
All backend logic must live inside Next.js route handlers at `apps/chatbot/src/app/api/*`. No standalone servers or background workers are allowed.

## Widget preview surfaces
- `http://localhost:3000/` renders the default Tandem widget in the shell.
- `http://localhost:3000/demo` toggles between Tandem’s default tokens and a sample client theme with CTA-rich messages.

Favor small, verifiable changes: share primitives through `packages/ui-kit`, common types through `packages/shared`, and keep backend work in the App Router.
