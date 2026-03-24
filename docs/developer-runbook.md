# Developer Runbook

Practical guide for developing, building, and deploying the Tandem platform.

---

## Starting the Development Environment

### Prerequisites

- Node.js (v20+)
- npm (v10+)
- Supabase CLI (optional, for DB work)

### Initial Setup

```bash
# Clone and install
git clone <repo-url> && cd tandem
npm install

# Copy environment template
cp .env.example .env.local

# Required environment variables:
# NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
# OPENAI_API_KEY=<your-openai-key>  (if using OpenAI)
```

### Running the Dashboard

```bash
npm run dev         # Start dashboard on port 3100
npm run dev:reset   # Clean build artifacts + start fresh
```

### Running Checks

```bash
npm run typecheck   # TypeScript across all packages
npm run lint        # ESLint on dashboard
npm run build       # Full production build
npm run clean       # Remove stale .next/ and build artifacts
```

### Smoke Tests

```bash
npm run smoke:chat      # Chat endpoint test (production-like)
npm run smoke:chat:dev   # Chat endpoint test (dev mode)
npm run verify:api      # Full API endpoint verification
```

---

## How the Dashboard Works

The dashboard is a Next.js 16 App Router application at `apps/dashboard/`.

### Architecture

- **Pages**: `src/app/(console)/` — each subfolder is a route (overview, knowledge, conversations, etc.)
- **API routes**: `src/app/api/` — REST handlers for chat, businesses, locations, imports
- **Components**: `src/components/` — dashboard-specific UI (sidebar, topbar, import panel, etc.)
- **Hooks/utils**: `src/lib/` — store hooks, chat scope, location config client, widget theme

### State Management

The dashboard uses a mock-first, browser-persistent approach:

1. `packages/shared/src/mock-store.ts` stores `MockState` in `localStorage` (`tandem:mock-state`)
2. `apps/dashboard/src/lib/store-hooks.ts` binds the store to React via `useSyncExternalStore`
3. State updates trigger subscriber notifications across components

### Console Layout

`src/app/(console)/layout.tsx` wraps all console pages with `ConsoleSidebar` + `ConsoleTopbar`.

### Adding a New Page

```
1. Create src/app/(console)/<route>/page.tsx
2. Follow existing page patterns
3. Add sidebar nav entry in src/components/ConsoleSidebar.tsx
```

---

## How Crawler Systems Work

### Website Import Pipeline

The import system crawls restaurant websites and generates structured knowledge.

**Pipeline stages:**

1. **Queue** — API receives URL, creates `onboarding_import_runs` row (status: `queued`)
2. **Poll** — `scripts/worker/website-import-worker.ts` polls DB every 5s
3. **Claim** — Atomic status update: `queued` → `running`
4. **Crawl** — `crawlWebsite()` fetches HTML, classifies pages, extracts signals
5. **Extract** — LLM-assisted structured knowledge generation
6. **Store** — Result JSON saved to import run (status: `succeeded`)
7. **Review** — Operator reviews draft in Knowledge UI
8. **Apply** — `POST /api/website-import/:runId/apply` merges draft into location config

### Running the Worker

```bash
npm run worker:imports
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### Key Files

| File | Purpose |
|------|---------|
| `scripts/worker/website-import-worker.ts` | Async processor |
| `apps/dashboard/src/lib/website-import/` | Core logic (crawl, classify, extract) |
| `apps/dashboard/src/components/WebsiteImportPanel.tsx` | UI component |
| `apps/dashboard/src/app/api/website-import/` | API routes |

---

## How Chatbot Knowledge Ingestion Works

### Chat Flow

1. `ChatWidget` (ui-kit) hydrates history via `GET /api/chat`
2. User messages stream via `POST /api/chat`
3. Route handler delegates to `handleChatPost()` in `packages/shared/src/server/chat-handler.ts`
4. Handler retrieves latest 50 messages for context
5. `llmStream()` sends request to configured LLM provider
6. Response streams back to client, messages persisted via `getChatStore()`

### Knowledge Sources

- **Structured knowledge** — imported from restaurant websites via the crawler
- **Knowledge config** — stored as JSONB in `business_location_configs.knowledge_config`
- **Manual authoring** — operators edit knowledge directly on the Knowledge page

### Chatbot Operating Model

For chatbot behavior design and quality assurance:

- `docs/chatbot-operating-model.md` — response decision flow, tone, handoff logic, recommendation rules
- `docs/chatbot-safety-and-boundaries.md` — scope boundaries, hallucination prevention, prompt injection defense
- `docs/chatbot-test-suite.md` — structured test prompts across all question categories
- `docs/chatbot-evaluation-rubric.md` — scoring criteria for evaluating response quality
- `docs/chatbot-gap-log.md` — tracked issues and recommended fixes

### LLM Configuration

```
LLM_PROVIDER=openai     # Default provider
LLM_MODEL=gpt-4o        # Default model
OPENAI_API_KEY=sk-...    # Required for OpenAI
```

Anthropic and Google providers are currently stubs that throw.

---

## How Supabase Migrations Work

### Authoritative Path

All migrations live in `supabase/migrations/`. Legacy migrations under `packages/shared/supabase/migrations/` are NOT used.

### Creating a Migration

```bash
npm run migration:new -- <name>    # Creates timestamped SQL file
# Edit the new file in supabase/migrations/
npm run guard:migrations           # Verify migration placement
npm run db:push                    # Push to remote Supabase
```

### Migration Commands

```bash
npm run db:status      # Check migration status vs remote
npm run db:push        # Push pending migrations
npm run db:pull        # Pull remote schema snapshot
npm run db:link        # Link to remote Supabase project
npm run db:reset       # Reset local Supabase DB
npm run guard:schema   # Schema integrity check
```

### Database Reference

Full schema documentation: `docs/DATABASE_SCHEMA.md`

### Storage Fallback

Chat persistence follows this chain:

1. **Supabase** — when `NEXT_PUBLIC_SUPABASE_URL` is configured
2. **File store** — default local dev, writes to `.data/` at repo root
3. **In-memory** — fallback if file store initialization fails

---

## Deployment and Build Processes

### Build

```bash
npm run build    # Full production build of dashboard
npm run doctor   # Environment validation before deploy
```

### Deploy Targets

- **Dashboard**: Vercel (auto-deploys from `main` branch)
- **Import Worker**: Railway (or similar, long-running process)
- **Database**: Supabase (migrations via `npm run db:push`)

### Pre-Deploy Checklist

1. `npm run typecheck` — no type errors
2. `npm run lint` — no lint violations
3. `npm run build` — successful build
4. `npm run doctor` — environment variables validated
5. Push to `main` — triggers Vercel deployment
6. If migrations added: `npm run db:status` → `npm run db:push`

### Post-Deploy Verification

```bash
npm run verify:api     # Test API endpoints
npm run smoke:chat     # Test chat pipeline
```

---

## Common Development Workflows

### Modifying a Console Page

1. Navigate to `apps/dashboard/src/app/(console)/<route>/page.tsx`
2. Edit the page component
3. Run `npm run dev` to preview
4. Run `npm run typecheck` to validate

### Adding an API Route

1. Create `apps/dashboard/src/app/api/<path>/route.ts`
2. Export named handlers: `export async function GET(request: NextRequest) { ... }`
3. For streaming: add `export const runtime = "nodejs"`
4. Always validate `businessId` + `locationSlug` scope

### Working with the UI Kit

1. Edit components in `packages/ui-kit/src/`
2. Export new components from `packages/ui-kit/src/index.ts`
3. Import in dashboard as `import { Component } from '@tandem/ui-kit'`
4. Console styling: Tailwind classes. Widget styling: CSS Modules + tokens.

### Working with Shared Types

1. Define types in `packages/shared/src/types.ts`
2. Export from `packages/shared/src/index.ts`
3. Import as `import { Type } from '@tandem/shared'`

### Debugging Chat Issues

```bash
npm run check:chat-store   # Validate chat store selection and path
npm run smoke:chat:dev     # Test chat locally
```

---

## Documentation References

| Document | Purpose |
|----------|---------|
| `docs/system-architecture.md` | System behavior & data flows |
| `docs/knowledge-ingestion-spec.md` | Crawler & knowledge pipeline spec |
| `AGENTS.md` | AI agent orientation |
| `docs/repo-map.md` | Full repository map |
| `docs/REPO_INDEX.md` | Quick navigation |
| `docs/DATABASE_SCHEMA.md` | Schema reference |
| `docs/architecture.md` | Architecture overview |
| `docs/system-map.md` | Runtime architecture |
| `docs/product/dashboard-product-improvements.md` | Product UX audit |
