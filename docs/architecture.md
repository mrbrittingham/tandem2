# Tandem Architecture

> **Status**: current as of branch `tandem3/pass-7-chatbot-event-followup` (March 2026).
> For detailed system-behaviour flows see `docs/system-architecture.md`.
> For a code-navigation index see `docs/REPO_INDEX.md`.
> For DB schema details see `docs/DATABASE_SCHEMA.md`.

---

## 1. Monorepo overview

This is an npm workspaces monorepo. Root package name: `tandem2` (legacy artifact — not significant).

| Workspace | Path | Purpose |
|-----------|------|---------|
| Dashboard app | `apps/dashboard` | Next.js 16 App Router operator console + all API routes. Port 3100. |
| Shared package | `packages/shared` | `@tandem/shared` — domain types, mock-store, LLM client, storage adapters, server helpers |
| UI kit package | `packages/ui-kit` | `@tandem/ui-kit` — embeddable `ChatWidget` + full design-system primitive library |

Non-workspace runtime:
- `scripts/worker/website-import-worker.ts` — async import poller; run separately via `npm run worker:imports`.
- `supabase/` — Supabase CLI project config + authoritative migration path.

---

## 2. Dashboard console navigation

The console has four top-level routes exposed in `ConsoleTopbar`:

| Label | Route | Description |
|-------|-------|-------------|
| Home | `/overview` | AI-oriented read-only overview panel with chatbot quick-prompt chips |
| Conversations | `/conversations` | Chat history viewer |
| Chatbot | `/chatbot` | 4-tab chatbot config UI |
| Account | `/account` | Business identity, integrations stub, team/billing stubs |

### Chatbot tabs (`/chatbot`)

| Tab | Backing route/page | Description |
|-----|--------------------|-------------|
| Knowledge | `/knowledge` | Restaurant knowledge editor + website import panel |
| Handoff | `/handoff` | Escalation/handoff contact configuration |
| Behavior | `/intents` | AI persona, behavior rules, tone settings |
| Appearance | `/widget` | Widget theme customization + embed snippet |

### Redirect map

Legacy routes redirect to current equivalents via `next.config.ts`:

| Old route | Redirects to |
|-----------|-------------|
| `/settings` | `/account` |
| `/integrations` | `/account` |
| `/menus` | `/chatbot?tab=knowledge` |
| `/appearance` (page dir) | n/a — only exists if chatbot tab |

---

## 3. API surface

All API routes live under `apps/dashboard/src/app/api/`.

### Core chat APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | GET | Hydrate chat history for a sessionId |
| `/api/chat` | POST | Stream assistant response |
| `/api/conversations` | GET | List sessions by `businessId + locationSlug` |
| `/api/conversations/[sessionId]` | GET | Session detail |

### Operator AI (tool-calling)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/operator-chat` | POST | AI turn with tool calls (Vercel AI SDK `generateText`) |
| `/api/operator-chat/confirm` | POST | Secure write boundary — apply AI-proposed change to Supabase |

**These two routes are production-critical. Do not modify them without explicit instruction.**

`/api/operator-chat/confirm` enforces:
- Supabase session auth
- Business membership check
- Validation of proposed change schema before writing

Nine operator tools are currently implemented: `set_business_hours`, `add_faq`, `update_faq`, `remove_faq`, `set_handoff_contact`, `remove_handoff_contact`, `update_handoff_settings`, `set_behavior_rules`, `update_business_info`.

### Business / location / config

| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/businesses` | Business CRUD |
| `GET/POST /api/locations` | Location CRUD |
| `GET/PUT /api/location-config` | Location knowledge + theme config |
| `POST /api/widget-theme` | Widget theme write |
| `POST /api/bootstrap` | Initialize user membership |

### Website import

| Endpoint | Description |
|----------|-------------|
| `POST /api/website-import/start` | Queue an import run |
| `GET /api/website-import/latest` | Latest run metadata for a scope |
| `GET /api/website-import/[runId]` | Run status + draft result |
| `POST /api/website-import/[runId]/apply` | Merge draft into location config |
| `GET /api/location/[locationId]/website-import` | Queue by locationId |

### Diagnostics

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Liveness check |
| `GET/POST /api/llm-test` | LLM provider/model visibility + generation smoke test |
| `GET /api/debug/env` | Non-prod env diagnostics |

---

## 4. Data flow: chat

```
ChatWidget (packages/ui-kit)
  GET /api/chat?businessId=&locationSlug=    → hydrate history
  POST /api/chat { businessId, locationSlug, messages }
    → apps/dashboard/src/app/api/chat/route.ts
      → @tandem/shared/server / chat-handler.ts
        → llmStream() [packages/shared/src/llm/client.ts]
        → getChatStore() [packages/shared/src/storage/index.ts]
            Supabase → file (.data/) → in-memory
```

Session continuity: `tandem_session` cookie. Message context capped at 50.

---

## 5. Data flow: operator AI tool-calling

```
ConsoleSidebar chat input
  POST /api/operator-chat { messages, businessId, locationSlug }
    → generateText() with tool definitions
      → tool call selected by model
    → response includes { role: "pending_change", toolCall: {...} }
  ConfirmationCard rendered in sidebar
  Operator clicks Confirm
  POST /api/operator-chat/confirm { toolCall, businessId, locationSlug }
    → auth + membership check
    → validated write to Supabase via location-config API
    → mock-store updater called for immediate UI refresh
    → configVersion bump signals page re-fetch
```

---

## 6. Data flow: website import

```
Knowledge page → POST /api/website-import/start
  → creates onboarding_import_runs row (status: queued)
scripts/worker/website-import-worker.ts
  → polls every 5s for queued rows
  → atomic queued → running
  → crawlWebsite() → classify pages → extract structured knowledge
  → stores result JSON in import run (status: succeeded)
Operator reviews draft
  → POST /api/website-import/[runId]/apply
    → merges draft into business_location_configs
```

---

## 7. Shared package boundaries

| Import path | Use context |
|-------------|-------------|
| `@tandem/shared` | Client-safe: types, mock-store, business config helpers |
| `@tandem/shared/server` | Server-only: LLM client, chat handler, storage, auth guards |
| `@tandem/ui-kit` | Presentational: ChatWidget, design system primitives |

---

## 8. Persistence

- **Supabase** — primary (when env configured)
- **File store** — `.data/` at repo root (default local dev); auto-falls back to `/tmp/.tandem` in serverless
- **In-memory** — last-resort fallback

Active migration path: `supabase/migrations/`. Do NOT add production migrations to `packages/shared/supabase/migrations/`.

Scope contract: all chat/conversation reads and writes are keyed by `(businessId, locationSlug)`.

---

## 9. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | |
| `OPENAI_API_KEY` | Yes (OpenAI) | |
| `LLM_PROVIDER` | No | Default: `openai` |
| `LLM_MODEL` | No | Default: `gpt-4o` (must be a valid OpenAI model name) |
| `TANDEM_DATA_DIR` | No | Override file store path |
| `TANDEM_API_KEY` | No | API authentication guard |
| `TANDEM_ALLOWED_BUSINESS_IDS` | No | Comma-separated allowlist |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker only | Import worker auth |

Env template: `apps/dashboard/.env.example`. Canonical runtime env: `apps/dashboard/.env.local`.

---

## Related references

- Full system behavior flows: `docs/system-architecture.md`
- Code navigation index: `docs/REPO_INDEX.md`
- DB schema reference: `docs/DATABASE_SCHEMA.md`
- System map (runtime scope contracts): `docs/system-map.md`
- Chatbot operating model: `docs/chatbot-operating-model.md`
- Operator AI tool design: `docs/tandem3transition/operator-ai-tool-architecture.txt`
