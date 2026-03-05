# Tandem Architecture Snapshot

## Runtime boundaries

| Layer | Location | Notes |
| --- | --- | --- |
| API surface | `apps/dashboard/src/app/api/*` | Canonical backend surface for chat, conversations, bootstrap, health, and widget theme endpoints. |
| Operator UI | `apps/dashboard/src/app/(console)/*` | Dashboard console for business/location setup, preview, and conversation operations. |
| Shared domain + server utilities | `packages/shared` | Types, mock store, LLM clients, storage adapters, and server chat/auth helpers. |
| Widget surface | `packages/ui-kit` | Embeddable `ChatWidget` and runtime config normalization. |

## Key design constraints

- Keep backend logic in App Router route handlers only.
- Use `@tandem/shared/server` only in server contexts.
- Keep chat request handling centralized through shared chat handlers.
- Preserve business/location scoping for conversation and history retrieval paths.

## Related docs

- Full system map: `docs/system-map.md`
- Current implementation status: `docs/current-status.md`
- Operational procedures: `RUNBOOK.md`
- Stabilization plan: `docs/stabilization-plan.md`
