# Tandem System Architecture

This document explains how the entire Tandem platform works — its subsystems, data flows, and runtime components. For repository structure and file locations, see `docs/repo-map.md`.

---

## 1. Platform Overview

Tandem is a restaurant-focused AI platform that provides:

- **AI chatbot widgets** — embeddable chat components that answer customer questions using structured knowledge extracted from a business's website and operator-authored content.
- **Operator dashboard** — a Next.js console where restaurant operators manage their business profile, knowledge base, widget appearance, handoff rules, and review conversation analytics.
- **Website crawler** — an async pipeline that crawls restaurant websites, classifies pages, and extracts structured knowledge (hours, menus, contact info, FAQs) for the chatbot.
- **Supabase backend** — PostgreSQL database for persistence of businesses, locations, configs, chat sessions, messages, and import runs, with a file-store fallback for local development.
- **Shared UI system** — a design system (`@tandem/ui-kit`) of primitives, layout components, overlays, and workflow elements used by both the dashboard and the embeddable widget.

---

## 2. High-Level System Diagram

The following describes how data flows through the Tandem platform end-to-end:

```
Restaurant Website
       │
       ▼
┌──────────────┐
│   Crawler    │  (website-import-worker polls DB for queued jobs)
│  crawl +     │
│  classify    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Knowledge   │  (LLM-assisted extraction of structured data)
│  Extraction  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Knowledge   │  (stored as JSONB in business_location_configs)
│    Store     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Chatbot    │  (llmStream → handles POST /api/chat with knowledge context)
│   Engine     │
└──────┬───────┘
       │
       ├────────────────────────┐
       ▼                        ▼
┌──────────────┐      ┌──────────────────┐
│ Chat Widget  │      │ Operator         │
│ (embedded)   │      │ Dashboard        │
└──────────────┘      └──────────────────┘
       │                        │
       └────────┬───────────────┘
                ▼
       ┌──────────────┐
       │   Supabase   │  (PostgreSQL: sessions, messages, configs, imports)
       │   Database   │
       └──────────────┘
```

---

## 3. Major Subsystems

### Dashboard (`apps/dashboard`)

The operator console built with Next.js 16 App Router. Provides pages for:

- Business and location management
- Knowledge authoring and website import review
- Widget appearance customization
- Conversation analytics and chat history
- Handoff/escalation configuration
- LLM and integration settings

Runs on port 3100. Uses Tailwind 4 for styling and `@tandem/ui-kit` primitives for components.

### Chatbot Engine (`packages/shared/src/server/`)

The server-side chat handler that powers AI responses:

- `chat-handler.ts` — orchestrates message persistence, context assembly (latest 50 messages), and LLM streaming.
- `llm/client.ts` — provider abstraction supporting OpenAI (default), with Anthropic/Google as future stubs.
- `llmStream()` — streams LLM responses back to the client via `POST /api/chat`.
- Knowledge context from `business_location_configs.knowledge_config` is injected into the LLM prompt.

> **Chatbot operating model**: See `docs/chatbot-operating-model.md` for response decision flow, tone rules, and handoff behavior. See `docs/chatbot-safety-and-boundaries.md` for scope limits, hallucination prevention, and abuse handling.

### Crawler (`scripts/worker/website-import-worker.ts`)

An async worker that processes website import jobs:

- Polls Supabase every 5 seconds for `queued` import runs.
- Atomically claims jobs (`queued → running`).
- Delegates to crawl, classify, and extract logic in `apps/dashboard/src/lib/website-import/`.
- Stores structured draft results back to the import run record.

### Knowledge Ingestion (`apps/dashboard/src/lib/website-import/`)

For the full pipeline specification, see `docs/knowledge-ingestion-spec.md`.

The core logic for turning raw website content into structured knowledge:

- **Crawl** — fetches HTML pages from the target website.
- **Classify** — categorizes pages (menu, hours, contact, about, etc.).
- **Extract** — uses LLM to pull structured data (business hours, addresses, menu items, FAQs).
- **Schema** — defines the shape of extracted knowledge for validation.

Operators review the extracted draft on the Knowledge page before applying it to their location config.

### Supabase Backend (`supabase/migrations/`)

PostgreSQL database managed via Supabase:

- **`businesses`** — business entities with name and slug.
- **`business_locations`** — physical locations per business.
- **`business_location_configs`** — JSONB blobs storing assistant, knowledge, handoff, widget, and integration configs.
- **`chat_sessions`** — conversation sessions scoped by `businessId + locationSlug`.
- **`chat_messages`** — individual messages with role (user/assistant/system).
- **`onboarding_import_runs`** — website import job tracking with status lifecycle.
- **`business_memberships`** / **`operator_profiles`** — auth and role management.

Storage follows a fallback chain: Supabase → file store (`.data/`) → in-memory.

### UI Kit (`packages/ui-kit`)

A shared design system providing:

- **Primitives** — Button, Input, Textarea, Select, Switch, Checkbox, Badge, Avatar, IconButton.
- **Layout** — AppShell, Sidebar, Topbar, PageContainer, PageHeader, Card, Divider, Stack.
- **Overlays** — Dialog, Popover, DropdownMenu, Tooltip (Radix UI wrappers).
- **Data display** — Table, StatCard, ActivityFeed.
- **Feedback** — Skeleton, Spinner, Toaster, EmptyState, ProgressBar.
- **Workflow** — Stepper, StatusPill, LogList, SplitPanel.
- **ChatWidget** — the embeddable chat component that end users interact with.

Console pages use Tailwind classes; the widget uses CSS Modules + design tokens.

---

## 4. Data Flow

### From Website to Knowledge Base

1. **Operator initiates import** — `POST /api/website-import/start` creates an `onboarding_import_runs` row with status `queued`.
2. **Worker picks up job** — the website-import worker polls the database, claims the job atomically.
3. **Crawl** — the worker fetches pages from the restaurant's website.
4. **Classify** — each page is categorized by type (menu, hours, contact, about, etc.).
5. **Extract** — LLM-assisted extraction produces structured knowledge (hours, addresses, menu items, emails, FAQs).
6. **Store draft** — extracted data is saved as a JSON draft on the import run record (status `succeeded`).
7. **Operator review** — the operator reviews and edits the draft on the Knowledge page in the dashboard.
8. **Apply** — `POST /api/website-import/:runId/apply` merges the approved draft into `business_location_configs.knowledge_config`.

### From Knowledge to Chat Response

1. **Widget loads** — `ChatWidget` calls `GET /api/chat` to hydrate conversation history.
2. **User sends message** — `POST /api/chat` receives the message.
3. **Context assembly** — the chat handler retrieves the latest 50 messages plus knowledge config for the scoped `businessId + locationSlug`.
4. **LLM streaming** — `llmStream()` sends the assembled prompt to the configured LLM provider.
5. **Response delivery** — the LLM response streams back to the widget in real time.
6. **Persistence** — both user and assistant messages are persisted via `getChatStore()`.

---

## 5. Runtime Components

### Dashboard Console Pages

Located in `apps/dashboard/src/app/(console)/`, these are the operator-facing pages:

- `/overview` — dashboard home with setup score
- `/knowledge` — knowledge editor + website import panel
- `/conversations` — chat history viewer
- `/widget` — widget customization + embed snippet
- `/appearance` — theme customization
- `/assistant-settings` — LLM behavior configuration
- `/locations`, `/businesses` — entity management
- `/handoff` — escalation rules
- `/analytics` — conversation analytics

### API Routes

Located in `apps/dashboard/src/app/api/`, these handle all server-side logic:

- `/api/chat` — chat streaming (GET for history, POST for new messages)
- `/api/conversations` — session listing and detail
- `/api/businesses`, `/api/locations` — entity CRUD
- `/api/location-config` — knowledge and theme configuration
- `/api/website-import/*` — import queue, status, and apply endpoints
- `/api/health` — liveness check
- `/api/bootstrap` — membership initialization

### Widget Embed

The `ChatWidget` component from `@tandem/ui-kit` is the embeddable chat interface:

- Configured via `businessToWidgetConfig()` which maps `BusinessProfile` → `WidgetContentConfig`.
- Styled via CSS Modules and design tokens (`ThemeTokens` → CSS custom properties).
- Communicates with the backend exclusively through `/api/chat`.
- Session continuity maintained via `tandem_session` cookie.

### Supabase Tables

See `docs/DATABASE_SCHEMA.md` for the full schema reference. Key tables:

| Table | Role |
|-------|------|
| `businesses` | Business identity |
| `business_locations` | Physical locations |
| `business_location_configs` | All config (knowledge, widget, assistant, handoff) |
| `chat_sessions` | Conversation containers |
| `chat_messages` | Message records |
| `onboarding_import_runs` | Import job lifecycle |

---

## 6. Future Architecture Direction

The Tandem platform is evolving toward a modular, AI-agent-friendly architecture:

- **Modular subsystems** — each major capability (chat, knowledge, import, analytics) is designed to operate as an independent module with clear API boundaries, making it easier to extend or replace individual pieces.
- **AI-agent readability** — documentation is structured so that AI coding agents can orient themselves quickly via `AGENTS.md` → `docs/repo-map.md` → `docs/system-architecture.md`, enabling faster and safer code modifications.
- **Structured knowledge over FAQ-first** — the platform prioritizes classification-first website import and structured data extraction over simple FAQ lists, producing richer chatbot context.
- **Provider-agnostic LLM layer** — the `llm/client.ts` abstraction is designed to support multiple LLM providers (OpenAI, Anthropic, Google) via environment configuration, with only OpenAI currently active.
- **Automated documentation** — the `scripts/generate-docs.ts` generator keeps structural documentation in sync with the codebase, reducing drift between docs and reality.
- **Separation of concerns** — client-safe code (`@tandem/shared`) is strictly separated from server-only code (`@tandem/shared/server`), preventing accidental exposure of secrets or server logic to the browser.
