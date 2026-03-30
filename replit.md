# Tandem Monorepo

## Project Overview
Tandem is an npm workspaces monorepo for an operator dashboard built with Next.js. It includes shared packages for types, LLM/provider routing, storage adapters, and UI components.

## Architecture

### Workspace Layout
| Path | Purpose |
|------|---------|
| `apps/dashboard` | Next.js 16 App Router app (operator console + API routes) |
| `packages/ui-kit` | `ChatWidget` and widget runtime config helpers |
| `packages/shared` | Shared types, mock store, LLM/provider routing, storage adapters, server helpers |
| `supabase` | Supabase CLI config + migration path |

### Core Rules
- Backend logic stays in Next.js route handlers under `apps/dashboard/src/app/api/**`
- Use `@tandem/shared` for client-safe imports and `@tandem/shared/server` for server-only code
- Shared domain logic in `packages/shared`, shared presentation in `packages/ui-kit`

## Development

### Running the App
The app runs via the "Start application" workflow, which executes `npm run dev` from the root. This delegates to the dashboard workspace and starts Next.js on port 3100.

### Package Manager
npm with workspaces (package-lock.json present). Run `npm install` from repo root.

### Key Scripts (run from repo root)
- `npm run dev` — Start dashboard on port 3100
- `npm run build` — Build dashboard
- `npm run lint` — Lint dashboard
- `npm run typecheck` — Type-check all packages

## Required Environment Variables

All secrets must be set via **Replit Secrets** (Settings → Secrets in the Replit UI).
Do not store secrets in `.replit` or any committed file.

### Required (app + auth)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `OPENAI_API_KEY` — OpenAI API key

### Required (import worker)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only; never expose to browser)

### Required (Supabase CLI scripts: db:push, db:pull, db:status)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

### Optional
- `LLM_MODEL` — Global model fallback (default: `gpt-4o`)
- `LLM_MODEL_WIDGET` — Override model for customer-facing chat widget
- `LLM_MODEL_OPERATOR` — Override model for operator dashboard AI assistant
- `TANDEM_API_KEY` — Internal API guard key for smoke-test scripts
- `TANDEM_ALLOWED_BUSINESS_IDS` — Comma-separated business slugs allowed to call `/api/chat`
- `TANDEM_DATA_DIR` — Override chat session file-store path (default: `.data/` at repo root)

## Design System

### Token Files
- `packages/ui-kit/src/tokens/tokens.css` — Base design tokens (colors, spacing, typography, shadows)
- `apps/dashboard/src/app/tandem-console-tokens.css` — Console-specific overrides (sidebar, cards, header)
- `apps/dashboard/src/app/globals.css` — Tailwind config + legacy aliases

### Key Palette (v2 rework)
- Sidebar bg: `#0B1A2E` with gradient to `#091628`
- Primary blue: `#2563EB` / hover `#1D4ED8`
- Page bg: `#F5F7FA`
- Card bg: `#FFFFFF` with `border-[var(--color-border)]` + `shadow-xs`

### Layout Components (`packages/ui-kit/src/layout/`)
- `AppShell` — CSS grid: `[264px sidebar | 1fr content]`, fixed width on desktop, no collapse
- `Sidebar` — Dark navy panel container (264px, always visible desktop / drawer on mobile)
- `SidebarItem` — Nav item (legacy, available but not used in current nav layout)
- `Topbar` — Generic topbar primitive (not used in console; console has its own dark topbar)
- `Card`, `PageHeader`, `PageContainer` — Content primitives

### Dashboard-specific Components (`apps/dashboard/src/components/`)
- `ConsoleSidebar` — **AI Chat Panel** (264px, dark navy): gradient bot avatar, "Hey there!" greeting, 3 quick-action chips, live chat messages with streaming + markdown, text input + mode toggle. Calls `/api/chat` with the active business/location IDs.
- `ConsoleTopbar` — **Dark horizontal tab nav** (same navy as sidebar): tabs for Overview | Conversations | Chatbot | Account + location switcher + user avatar dropdown
- `SectionCard` — Primary card component for page content sections

### Layout Structure
```
[ConsoleSidebar 264px dark] | [ConsoleTopbar dark nav]
                               [page content light bg]
```
- ConsoleSidebar (AI chat panel) is always visible
- No sidebar collapse — fixed layout throughout

## Feature: Menu Organizer (`/menus`)
Restaurant menus are stored in `knowledge_config.structuredWebsiteKnowledge.menuSections` (JSONB, Supabase).

### Data shape
```ts
type MenuSection = { id, title, sourceUrl, include, items: MenuItem[] }
type MenuItem    = { id, name, price, description, dietaryNotes, include }
```

### Pages / routes
- `apps/dashboard/src/app/(console)/menus/page.tsx` — Full client-side editor
  - Loads from `GET /api/location-config`
  - Saves via `saveLocationConfig` → `PUT /api/location-config` with `knowledgeConfig.structuredWebsiteKnowledge`
  - "Extract from website" calls `POST /api/website-import/menu-extract` (URL or pasted text)
  - Merges extracted sections, skipping duplicates by title
  - Inline editing: section titles, item name/price/description/dietary notes
  - Add/delete sections and items; collapsible section cards; SaveBar for unsaved changes

### AI integration
- `apps/dashboard/src/app/api/chat/route.ts` reads `menuSections` from `structuredWebsiteKnowledge`
- Sections are injected into the system prompt as knowledge for the chatbot
- `menuSectionTitles` injected separately so the bot can name categories in clarifying questions

## Auth Architecture
Login uses a Next.js Server Action (`apps/dashboard/src/app/login/actions.ts`) that calls `signInWithPassword` via `createSupabaseServerClient()`. This sets proper `Set-Cookie` headers server-side. The client (`LoginPageClient.tsx`) uses `useTransition` + `window.location.href` redirect on success.

The middleware is at `apps/dashboard/src/proxy.ts` — exported as `proxy` (Next.js 16 special-case for `/src/proxy` path).

## Replit Configuration
- Port: 3100 (webview)
- Host: 0.0.0.0
- Node.js 20
- Workflow: "Start application" → `npm run dev`
