# Tandem 2.0 Monorepo

Tandem 2.0 is an npm workspaces monorepo for a concierge chatbot product with a dashboard app plus shared widget and domain/server packages.

## Workspace layout

| Path | Purpose |
| --- | --- |
| `apps/dashboard` | Operator console for business setup, content, handoff, and conversation monitoring (port 3100) |
| `packages/ui-kit` | Reusable `ChatWidget` implementation and themeable UI surface |
| `packages/shared` | Shared domain types, mock state store, LLM client wrappers, and chat storage adapters |

## Current product progress

- Widget runtime is implemented in `@tandem/ui-kit` with Chat + Help tabs, FAQ search, handoff CTA, and streamed responses.
- Dashboard console is implemented with routes for overview, businesses, knowledge, intents, handoff, widget, integrations, conversations, and LLM status.
- Business configuration is currently mock-first and browser-persistent (`localStorage` key `tandem:mock-state`).
- Chat history persistence is implemented through shared storage with file-backed data in `.data/` (fallback to in-memory).

## Architecture rules

- Backend logic lives only in Next.js App Router route handlers under `src/app/api/**`.
- Keep server-only imports on `@tandem/shared/server`; use `@tandem/shared` in client-safe code.
- Keep chat route behavior aligned with shared handlers in `@tandem/shared/server`.
- Reusable cross-app logic belongs in `packages/shared`; reusable UI belongs in `packages/ui-kit`.

## Local development

Run from repo root:

| Command | Description |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Start dashboard app on http://localhost:3100 |
| `npm run lint` | Lint dashboard workspace |
| `npm run typecheck` | Type-check shared, ui-kit, and dashboard packages |
| `npm run build` | Build dashboard app |
| `npm run clean` | Remove stale `.next` and `*.tsbuildinfo` artifacts |

## Environment and integrations

- LLM provider selection is env-driven in `packages/shared/src/llm/client.ts`.
- Supported provider today: OpenAI.
	- `LLM_PROVIDER=openai` (default)
	- `LLM_MODEL=gpt-5.2` (default)
	- `OPENAI_API_KEY` required for generation/streaming
- Anthropic and Google providers exist as placeholders and currently throw not-implemented errors.
- Optional: `TANDEM_DATA_DIR` overrides chat persistence directory (default resolves to repo `.data/`).

## Validation expectations

- There is no automated test suite in this repo yet.
- Validate changes with lint + typecheck and by exercising relevant pages/routes:
	- Dashboard: `http://localhost:3100/`
	- LLM connectivity check: dashboard `LLM status` page (`/llm`)
