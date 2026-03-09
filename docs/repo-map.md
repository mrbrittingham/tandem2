# Tandem Repository Map

<!-- AUTO-GENERATED SECTION: architecture-overview -->

## Architecture Overview

Tandem is an npm workspaces monorepo for a restaurant-focused operator platform. It consists of one Next.js app, two shared packages, async workers, and Supabase-backed persistence.

| Layer | Location | Purpose |
|-------|----------|---------|
| App | `apps/dashboard` | dashboard |
| Package | `packages/shared` | @tandem/shared |
| Package | `packages/ui-kit` | @tandem/ui-kit |
| Worker | `scripts/worker/` | Async website-import processor |
| Database | `supabase/migrations/` | Supabase schema (authoritative migration path) |
| Scripts | `scripts/` | CLI helpers for dev, deploy, migration, smoke tests |

<!-- END AUTO-GENERATED SECTION: architecture-overview -->

<!-- AUTO-GENERATED SECTION: directory-map -->

## Major Directories

```
tandem/
├── apps/
│   └── dashboard/
├── packages/
│   ├── shared/
│   ├── ui-kit/
│   │   └── src/
│   │       ├── data/
│   │       ├── feedback/
│   │       ├── layout/
│   │       ├── lib/
│   │       ├── overlay/
│   │       ├── primitives/
│   │       ├── tokens/
│   │       ├── workflow/
├── scripts/
│   ├── worker/
│   └── guard/
├── supabase/
│   └── migrations/
├── docs/
│   └── product/                (manually maintained)
└── .github/
```

<!-- END AUTO-GENERATED SECTION: directory-map -->

## Dashboard Entrypoints

### Console Pages (`apps/dashboard/src/app/(console)/`)

| Route | File | Purpose |
|-------|------|---------|
| `/overview` | `overview/page.tsx` | Dashboard home, setup score |
| `/knowledge` | `knowledge/page.tsx` | Restaurant knowledge editor + website import |
| `/conversations` | `conversations/page.tsx` | Chat history viewer |
| `/widget` | `widget/page.tsx` | Widget customization + embed snippet |
| `/appearance` | `appearance/page.tsx` | Theme customization |
| `/assistant-settings` | `assistant-settings/page.tsx` | LLM behavior config |
| `/locations` | `locations/page.tsx` | Location management |
| `/businesses` | `businesses/page.tsx` | Business management |
| `/handoff` | `handoff/page.tsx` | Escalation configuration |
| `/intents` | `intents/page.tsx` | Intent routing |
| `/integrations` | `integrations/page.tsx` | External integrations |
| `/channels` | `channels/page.tsx` | Communication channels |
| `/analytics` | `analytics/page.tsx` | Chat analytics |
| `/account` | `account/page.tsx` | User/team management |
| `/settings` | `settings/page.tsx` | General settings |
| `/llm` | `llm/page.tsx` | LLM provider settings |
| `/advanced` | `advanced/page.tsx` | Advanced settings |

### API Routes (`apps/dashboard/src/app/api/`)

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET/POST /api/chat` | `chat/route.ts` | Chat streaming (canonical) |
| `GET /api/conversations` | `conversations/route.ts` | List sessions by scope |
| `GET /api/conversations/:id` | `conversations/[sessionId]/route.ts` | Session detail |
| `GET/POST /api/businesses` | `businesses/route.ts` | Business CRUD |
| `GET/POST /api/locations` | `locations/route.ts` | Location CRUD |
| `GET/POST /api/location-config` | `location-config/route.ts` | Location knowledge + theme |
| `POST /api/widget-theme` | `widget-theme/route.ts` | Widget theme update |
| `POST /api/bootstrap` | `bootstrap/route.ts` | Initialize membership |
| `GET /api/health` | `health/route.ts` | Liveness check |
| `POST /api/website-import/start` | `website-import/start/route.ts` | Queue import run |
| `GET /api/website-import/latest` | `website-import/latest/route.ts` | Latest run metadata |
| `GET /api/website-import/:runId` | `website-import/[runId]/route.ts` | Run status + draft |
| `POST /api/website-import/:runId/apply` | `website-import/[runId]/apply/route.ts` | Apply draft to location |

## Crawler & Ingestion Entrypoints

| Component | Location | Description |
|-----------|----------|-------------|
| Import queue API | `apps/dashboard/src/app/api/website-import/start/route.ts` | Creates `queued` import run |
| Location import API | `apps/dashboard/src/app/api/location/[locationId]/website-import/route.ts` | Queue by location |
| Import worker | `scripts/worker/website-import-worker.ts` | Polls + processes queued runs |
| Crawl logic | `apps/dashboard/src/lib/website-import/` | Crawl, classify, extract, schema |
| Knowledge UI | `apps/dashboard/src/app/(console)/knowledge/page.tsx` | Import panel + editor |
| Apply route | `apps/dashboard/src/app/api/website-import/[runId]/apply/route.ts` | Merge draft → config |

## Shared Component Systems

### UI Kit Design System (`packages/ui-kit/src/`)

- **Primitives**: Button, Input, Textarea, Select, Switch, Checkbox, Badge, Avatar, Kbd, IconButton
- **Data**: Table, StatCard, ActivityFeed
- **Feedback**: Skeleton, Spinner, Toaster, EmptyState, ProgressBar
- **Layout**: AppShell, Sidebar, Topbar, PageContainer, PageHeader, Card, Divider, Stack
- **Overlays**: Dialog, Popover, DropdownMenu, Tooltip (Radix UI wrappers)
- **Workflow**: Stepper, StatusPill, LogList, SplitPanel
- **Tokens**: CSS custom properties for colors, spacing, typography, shadows

### Dashboard Components (`apps/dashboard/src/components/`)

ConsoleSidebar, ConsoleTopbar, LocationSwitcher, WebsiteImportPanel, ColorPicker, PreviewPanel, SaveBar, SectionCard, DataTableShell, EmptyState, CreateBusinessWizard, CreateLocationDialog, and more.

## Database Layer

### Schema (Supabase / PostgreSQL)

Active migration path: `supabase/migrations/` (9 migrations as of March 2026).

| Table | Purpose |
|-------|---------|
| `businesses` | Business entities (id, name, slug) |
| `business_locations` | Locations per business (address, website_url, slug) |
| `business_location_configs` | JSONB config blobs (assistant, knowledge, handoff, widget, integrations) |
| `business_memberships` | User-business role assignments |
| `operator_profiles` | Auth user metadata |
| `chat_sessions` | Conversation sessions (scoped by businessId + locationSlug) |
| `chat_messages` | Individual messages (role: user/assistant/system) |
| `onboarding_import_runs` | Website import job tracking (queued → running → succeeded/failed) |

### Storage Fallback Chain

1. **Supabase** — primary persistence (when env configured)
2. **File store** — `.data/` at repo root (default for local dev)
3. **In-memory** — fallback if file store init fails

### RPC Functions

- `bootstrap_membership(text, text)` — initialize user membership
- `create_business_location(text, text, uuid)` — create location with grants

## Subsystem Relationships

```
┌────────────────────────────┐
│     Dashboard Console      │  (Next.js App Router)
│  pages + components + lib  │
└──────────┬─────────────────┘
           │ imports
           ▼
┌──────────────────┐    ┌──────────────────┐
│  @tandem/ui-kit  │    │  @tandem/shared  │
│  ChatWidget +    │    │  types, mock-    │
│  design system   │    │  store, client   │
└──────────────────┘    └────────┬─────────┘
                                │ server export
                                ▼
                      ┌──────────────────┐
                      │ @tandem/shared/  │
                      │     server       │
                      │ LLM, storage,    │
                      │ auth, chat-      │
                      │ handler          │
                      └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌────────────┐   ┌──────────┐
        │ Supabase │   │ File Store │   │ In-Memory│
        │   (DB)   │   │  (.data/)  │   │ Fallback │
        └──────────┘   └────────────┘   └──────────┘

┌────────────────────────────┐
│  Website Import Worker     │  (scripts/worker/)
│  polls DB → crawl → store  │
└────────────────────────────┘
```

## Styling & Tokens

| File | Scope | Description |
|------|-------|-------------|
| `apps/dashboard/src/app/globals.css` | Dashboard | Global styles + Tailwind 4 |
| `apps/dashboard/src/app/tandem-console-tokens.css` | Dashboard | Console CSS custom properties |
| `packages/ui-kit/src/tandem-widget-tokens.css` | Widget | Widget CSS custom properties |
| `packages/ui-kit/src/tokens/` | Design system | Shared design tokens |
| `packages/ui-kit/src/ChatWidget.module.css` | Widget | Scoped widget styles |

## Environment Dependencies

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `OPENAI_API_KEY` | If using OpenAI | LLM API key |
| `LLM_PROVIDER` | No (default: openai) | LLM provider selection |
| `LLM_MODEL` | No (default: gpt-5.2) | LLM model selection |
| `TANDEM_DATA_DIR` | No | Override file store path |
| `TANDEM_API_KEY` | No | API authentication |
| `SUPABASE_SERVICE_ROLE_KEY` | For worker | Import worker auth |
