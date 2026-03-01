# Tandem Architecture Snapshot

| Layer | Location | Notes |
| --- | --- | --- |
| API surface | `apps/chatbot/app/api/*` | Only approved backend entry point. Route handlers talk to data sources (Supabase soon). |
| Chat surfaces | `apps/chatbot` | Customer-facing UI that consumes shared types + UI kit. |
| Future operator UI | `apps/dashboard` | Reserved for internal tooling; should use shared packages when ready. |
| Shared types | `packages/shared` | Pure TypeScript definitions, no React dependencies. |
| UI primitives | `packages/ui-kit` | React components rendered by apps; keep styling/theme tokens centralized here. |

Guidelines:
- Add new cross-cutting logic to `packages/*` instead of duplicating it inside apps.
- Keep package APIs small and typed; prefer `export type` + focused components.
- When adding backend functionality, create a new route handler inside `apps/chatbot/app/api/*` and keep it stateless.
