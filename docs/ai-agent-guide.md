# AI Agent Guide

A reference for AI coding agents working within the Tandem monorepo. This document complements `AGENTS.md` (fast-start orientation) with deeper guidance on safe, efficient codebase interaction.

---

## Architecture Summary

Tandem is an npm workspaces monorepo with three main packages:

| Package | Import Path | Purpose |
|---------|-------------|---------|
| `apps/dashboard` | — | Next.js 16 App Router console (port 3100) |
| `packages/ui-kit` | `@tandem/ui-kit` | Embeddable ChatWidget + shared design system |
| `packages/shared` | `@tandem/shared` / `@tandem/shared/server` | Domain types, mock store, LLM, storage, auth |

Supporting infrastructure:
- **Worker**: `scripts/worker/website-import-worker.ts` (async import processor)
- **Database**: Supabase PostgreSQL, migrations in `supabase/migrations/`
- **CI**: GitHub Actions (`.github/workflows/`)

### Canonical Scope

All data queries use the `(businessId, locationSlug)` pair:
- Chat sessions and messages
- Location configs (knowledge, handoff, widget, assistant)
- Conversations listing
- Widget configuration

---

## Important Entry Points

### For understanding the data model
- `packages/shared/src/types.ts` — all domain types
- `docs/DATABASE_SCHEMA.md` — Supabase schema reference

### For understanding API contracts
- `apps/dashboard/src/app/api/chat/route.ts` — canonical chat route (streaming)
- `apps/dashboard/src/app/api/conversations/route.ts` — conversation listing
- `apps/dashboard/src/app/api/location-config/route.ts` — location config CRUD

### For understanding UI patterns
- `apps/dashboard/src/app/(console)/overview/page.tsx` — typical console page
- `apps/dashboard/src/components/ConsoleSidebar.tsx` — navigation structure
- `apps/dashboard/src/lib/store-hooks.ts` — state management pattern

### For understanding imports/exports
- `packages/shared/src/index.ts` — client-safe export surface
- `packages/shared/src/server/index.ts` — server-only export surface
- `packages/ui-kit/src/index.ts` — UI kit export surface

---

## UI Component Reuse Patterns

### Rule: always check ui-kit first

Before creating a new component in the dashboard, check if `packages/ui-kit` already provides it:

| Need | UI Kit Component | Location |
|------|-----------------|----------|
| Button | `Button` | `primitives/Button` |
| Text input | `Input` | `primitives/Input` |
| Textarea | `Textarea` | `primitives/Textarea` |
| Select dropdown | `Select` | `primitives/Select` |
| Toggle | `Switch` | `primitives/Switch` |
| Dialog/Modal | `Dialog` | `overlay/Dialog` |
| Popover | `Popover` | `overlay/Popover` |
| Dropdown menu | `DropdownMenu` | `overlay/DropdownMenu` |
| Tooltip | `Tooltip` | `overlay/Tooltip` |
| Loading state | `Skeleton`, `Spinner` | `feedback/` |
| Table | `Table` | `data/Table` |
| Stat display | `StatCard` | `data/StatCard` |
| Page wrapper | `PageContainer` | `layout/PageContainer` |
| Page title bar | `PageHeader` | `layout/PageHeader` |
| Card container | `Card` | `layout/Card` |
| Status | `StatusPill` | `workflow/StatusPill` |

### Dashboard-specific components

These live in `apps/dashboard/src/components/` and should not be duplicated:
- `ConsoleSidebar` — navigation
- `ConsoleTopbar` — top bar with location switcher
- `SaveBar` — sticky save/discard footer
- `SectionCard` — knowledge section container
- `WebsiteImportPanel` — import UI

---

## Styling Token Usage

### Console (dashboard pages)

- Use **Tailwind 4 classes** for styling
- Console tokens are in `apps/dashboard/src/app/tandem-console-tokens.css`
- Global styles in `apps/dashboard/src/app/globals.css`
- Do NOT use CSS Modules for dashboard pages

### Widget (ChatWidget)

- Use **CSS Modules** (`ChatWidget.module.css`) for scoped styles
- Widget tokens are in `packages/ui-kit/src/tandem-widget-tokens.css`
- Theme customization via `ThemeTokens` type → CSS custom properties
- Do NOT use Tailwind for widget styles

### Design tokens (`packages/ui-kit/src/tokens/`)

- Shared color, spacing, typography, and shadow tokens
- Used by both console and widget through CSS custom properties
- Edit here for global design changes

---

## Incremental File Scanning Strategy

### Phase 1: Orientation (always)
```
AGENTS.md                              (~200 lines)
docs/repo-map.md                       (~200 lines)
```

### Phase 2: Task-specific context
```
# For UI work:
packages/ui-kit/src/index.ts           (export surface)
apps/dashboard/src/components/          (list directory)

# For API work:
apps/dashboard/src/app/api/<route>/     (read specific route)
packages/shared/src/server/index.ts     (server exports)

# For type work:
packages/shared/src/types.ts           (domain types)

# For DB work:
docs/DATABASE_SCHEMA.md                (schema reference)
supabase/migrations/                   (list migrations)
```

### Phase 3: Implementation
Read only the specific files you need to edit, plus immediately adjacent files for context.

---

## Strategies for Minimizing Context Usage

1. **Read index files first** — `index.ts` files list all exports without full source.
2. **Use `rg` for targeted search** — search exact function/type names before scanning broadly.
3. **Skip generated files** — `.next/`, `node_modules/`, `.data/` contain no authorial content.
4. **Batch related reads** — read all files for a subsystem in one pass.
5. **API routes are self-contained** — each route file has its full contract; read one to understand all.
6. **Types file is canonical** — `packages/shared/src/types.ts` defines everything; read once.
7. **Use `docs/REPO_INDEX.md`** — quick navigation to high-value code areas.

### What NOT to read

- `node_modules/` — never explore dependency source
- `.next/` — build output; meaningless for understanding code
- `docs/product/` — manually maintained product audits; read only if task is product-related
- Legacy migrations in `packages/shared/supabase/migrations/` — not authoritative

---

## Guidance for Large Refactors

### Before starting

1. Read `AGENTS.md` and `docs/repo-map.md` to understand the full system
2. Identify all subsystems affected by the refactor
3. Map out the dependency chain between affected files
4. Check `docs/DATABASE_SCHEMA.md` if persistence is involved

### During implementation

1. **Work subsystem by subsystem** — complete one area before moving to the next
2. **Run `npm run typecheck`** after each subsystem change to catch cascading issues
3. **Follow existing patterns** — read a nearby file as a template; don't invent new patterns
4. **Preserve canonical scope** — `businessId + locationSlug` must remain the canonical scope
5. **Keep mock store in sync** — if adding new state, update `MockState` type and `mock-store.ts`

### After changes

1. `npm run typecheck` — verify all packages compile
2. `npm run lint` — check code style
3. `npm run build` — full production build
4. `npm run smoke:chat:dev` — verify chat pipeline if affected

### Refactor boundaries

- **Do** move reusable logic from `apps/dashboard` to `packages/shared`
- **Do** extract repeated UI patterns into `packages/ui-kit` primitives
- **Do not** split `packages/shared` into more packages without explicit instruction
- **Do not** move API routes out of `apps/dashboard/src/app/api/`
- **Do not** rename canonical scope variables (`businessId`, `locationSlug`)
- **Do not** change the storage fallback chain order
