# Tandem Architecture Snapshot

| Layer | Location | Notes |
| --- | --- | --- |
| API surface | `apps/dashboard/src/app/api/*` | Route handlers for preview, conversations, integrations, and health checks. |
| Operator + preview surface | `apps/dashboard` | Dashboard is the product UI and hosts widget preview workflows. |
| Shared types | `packages/shared` | Pure TypeScript definitions, no React dependencies. |
| UI primitives | `packages/ui-kit` | React components rendered by apps; keep styling/theme tokens centralized here. |

Guidelines:
- Add new cross-cutting logic to `packages/*` instead of duplicating it inside apps.
- Keep package APIs small and typed; prefer `export type` + focused components.
- When adding backend functionality, create a new route handler inside `apps/dashboard/src/app/api/*` and keep it stateless.
