# Tandem Runbook

## Branch + Deploy Contract

- `main` = production branch.
   - Vercel production deploys from `main`.
   - Railway production worker deploys from `main`.
- `wip/desktop-sync` is optional and used only for large/unsafe work or when Mike explicitly requests it.
   - If used, Vercel preview/staging and Railway staging can track `wip/desktop-sync`.
- Standard day-to-day flow can commit/push directly on `main`.
- If a PR adds a file in `supabase/migrations/`, apply that migration to the correct Supabase project as part of deploy.

Deploy sequence (copy/paste checklist):
1. Push/merge changes to `main`.
2. Confirm Vercel and Railway deploys from `main` completed successfully.
3. If migrations were added, run `npm run db:status` then `npm run db:push` (or confirm already applied for the target project).
4. Run post-deploy verification (`/api/health`, import/chat happy path).

## Prerequisites

- Node.js + npm
- Supabase CLI (`supabase`)
- Access to linked Supabase project (for remote migrations)

## First-time setup

1. Install dependencies:
   - `npm install`
2. Create env file from template:
   - `cp .env.example .env.local`
3. Fill required env values (see below).

## Required environment variables

### App + auth (required)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### LLM (required for chat generation)
- `OPENAI_API_KEY`

### Optional
- `LLM_PROVIDER` (default: `openai`)
- `LLM_MODEL` (default: `gpt-5.2`)
- `TANDEM_DATA_DIR` (file-store override)
- `TANDEM_API_KEY`
- `TANDEM_ALLOWED_BUSINESS_IDS`
- `WEBSITE_IMPORT_MAX_PAGES` (default: `22`)

### Supabase migration automation (required for remote db push)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

### Import worker (required for async website imports)
- `SUPABASE_SERVICE_ROLE_KEY`
- `IMPORT_WORKER_POLL_MS` (default: `5000`)
- `IMPORT_WORKER_BATCH_SIZE` (default: `5`)

## Local development

- Start app: `npm run dev` (dashboard on `http://localhost:3100`)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Clean stale build artifacts: `npm run clean`

## Supabase workflow (authoritative)

This repo uses `supabase/migrations/*` as the migration source used by CLI push commands.

### Link to remote project
- `npm run db:link`

### Push migrations
- `npm run db:push`

### Check migration status
- `npm run db:status`

### Pull remote schema snapshot (read)
- `npm run db:pull -- <migration_name>`
- Example: `npm run db:pull -- 20260306120000_remote_snapshot`

### Create a new migration file (write authoring)
- `npm run migration:new -- <migration_name>`
- Example: `npm run migration:new -- add_chat_index`

### Local reset (local dev only)
- `npm run db:reset`

### Remote-only fallback (no local Docker/Supabase stack required)
If `supabase start` is unavailable in your environment, you can still run linked remote operations:
1. `npm run db:link`
2. `npm run db:status`
3. `npm run db:pull -- <migration_name>`
4. `npm run migration:new -- <migration_name>`
5. `npm run db:push`

These commands operate against the linked remote project (or `DATABASE_URL` when provided) and do not require `supabase start`.

### Migration guard (required)
- `npm run guard:migrations`
- This fails if any new SQL files are added in non-authoritative migration folders.

### One-time setup for non-interactive push

1. Install Supabase CLI:
   - macOS: `brew install supabase/tap/supabase`
   - Linux/other: follow Supabase CLI install docs.
2. Get project ref from Supabase dashboard:
   - Project Settings → General → `Reference ID`.
3. Create personal access token:
   - Supabase Dashboard → Account → Access Tokens.
4. Add env vars locally (for terminal use), e.g. in `.env.local`:
   - `SUPABASE_ACCESS_TOKEN=...`
   - `SUPABASE_PROJECT_REF=...`
   - `SUPABASE_DB_PASSWORD=...`
5. Run migration push:
   - `npm run db:link`
   - `npm run db:status`
   - `npm run db:pull -- <migration_name>` (optional, for read/snapshot)
   - `npm run migration:new -- <migration_name>` (for new SQL files)
   - `npm run db:push`

### GitHub Actions secret setup (for automatic migration push)

Add repository secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

The workflow `.github/workflows/supabase-migrations.yml` pushes migrations on `main` and supports manual `workflow_dispatch`.

### Vercel environment setup (recommended)

For visibility and operational parity, add the same values in Vercel project environment variables:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

These are not required for runtime API calls but keep deployment tooling consistent.

### Important note
- Do not add new production migrations to `packages/shared/supabase/migrations/*`.
- Historical files there are legacy and not the active push path for this repo.
- Reconciliation reference: `docs/migration-reconciliation.md`

## Runtime diagnostics

- Health: `GET /api/health`
- LLM status check:
  - `GET /api/llm-test` (provider/model/key visibility)
  - `POST /api/llm-test` (generation smoke test)
- Non-prod env diagnostics: `GET /api/debug/env`

## Website import onboarding

One-time website import is available in the Knowledge screen (`Import from Website`).

Imports are asynchronous: the API queues work and a separate worker processes queued runs.

### Flow

1. Open a location in the dashboard.
2. Go to Knowledge.
3. Enter a website URL and click `Run import` (this creates a queued run).
4. Wait for the run to move `queued -> running -> succeeded`.
5. Review/edit profile fields, FAQs, policies, and brand suggestions.
6. Click `Apply import` to write the draft to location config.
7. Use `Refresh import` to create a new draft from the same URL (no silent overwrite).

### API endpoints

- `POST /api/location/:locationId/website-import` → create queued import run
- `GET /api/website-import/:runId` → read run status + result draft
- `GET /api/website-import/:runId/debug` → per-run debug payload (non-prod diagnostics)
- `POST /api/website-import/:runId/apply` → apply reviewed draft to location knowledge/theme
- `POST /api/website-import/start` → helper to start by `businessId + locationSlug`
- `GET /api/website-import/latest?businessId=...&locationSlug=...` → latest run metadata for UI

### Worker operations

Run worker locally (separate terminal):
- `npm run worker:imports`

Production pattern:
- Host dashboard API on Vercel (or equivalent web runtime).
- Host `npm run worker:imports` as a separate long-running worker process (Railway/Fly/Render/VM/container).
- Ensure worker and API share the same Supabase project and environment values.

### Data written on apply

- `business_location_configs.knowledge_config`
   - imported summary, imported FAQs/policies, contact/hours snapshot, provenance (`runId`, URL)
- `business_location_configs.widget_config.theme`
   - mapped defaults for header/send/quick actions and brand/logo values
- `business_locations.website_url`
- `business_locations.last_import_run_id`

### Troubleshooting

- `Database schema not up to date. Run npm run db:push.`
   - Run `npm run db:link` then `npm run db:push` from repo root.
- `Could not find table 'public.onboarding_import_runs' in the schema cache`
   - Remote schema is behind code; run `npm run db:push`.
- `column business_locations.website_url does not exist`
   - Remote schema is behind code; run `npm run db:push`.

- `Location not found`
   - Ensure the active location exists in Supabase (`business_locations`) for the selected scope.
- `No crawlable pages found`
   - Try a canonical homepage URL and confirm robots/firewall does not block standard HTTP fetch.
- Run stuck in `queued`
   - Worker is not running or missing `SUPABASE_SERVICE_ROLE_KEY`.
- Run fails with `schema_out_of_date`
   - Apply latest migrations (`npm run db:push`) and restart worker.
- Import returns sparse draft
   - Site may be JS-heavy or lack crawlable text; review `/api/website-import/:runId/debug` and edit manually before Apply.
- Apply fails with `Forbidden`
   - Confirm membership row exists for the authenticated user in `business_memberships`.

### Quick sanity check after db push

1. Run `npm run db:push`.
2. While signed in to dashboard, call `GET /api/website-import/schema-check`.
3. Expected response:
   - `ok: true`
   - `checks.onboardingImportRunsTable: true`
   - `checks.businessLocationsWebsiteUrlColumn: true`
4. Open Knowledge page and confirm Website Import no longer shows schema errors.

## Verification

Minimal API sanity pass:

- `npm run verify:api`
- Requires a running local app server (for example `npm run dev`).

## CI checks

GitHub Actions enforces the following on PRs and pushes to `main`:

- `npm run guard:migrations`
- `npm run typecheck`

Notes:

- `npm run verify:api` is local-only and is not run in CI because it depends on a running server.

Optional scoped/auth overrides:

- `BASE_URL=http://localhost:3100 BUSINESS_ID=demo-biz LOCATION_SLUG=demo-location npm run verify:api`
- `AUTH_COOKIE='sb-...=...; sb-...=...' npm run verify:api` (for protected conversations route verification)
- `TANDEM_API_KEY_HEADER='<key>' npm run verify:api` (if API key guard is enabled)

What it checks:

- `/api/health` responds with `{ ok: true }`
- `/api/llm-test` returns a clear status shape (or auth/key guard status)
- `/api/chat` GET/POST accept canonical scoped payloads
- `/api/conversations` scoped request returns `200` when authenticated (or explicit `401`)

## Smoke checks

1. Start server:
   - `DEV_SMOKE=1 npm run dev`
2. Run smoke harness:
   - `DEV_SMOKE=1 npm run smoke:chat`

Expected output:

- Pass: `[smoke:chat] PASS sessionId=<uuid>`
- Fail: `[smoke:chat] FAIL: ...` with the exact failing route and fix hint.

Optional one-command flow (starts/stops dev server automatically):

- `npm run smoke:chat:dev`

## Common failures

- Symptom: `Missing required environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Fix: set both in `.env.local`, then retry request.
- Symptom: `Missing required environment variable(s): OPENAI_API_KEY`
   - Fix: set `OPENAI_API_KEY` when `LLM_PROVIDER=openai`.
- Symptom: `locationSlug required` or `businessId required` from `/api/chat` or `/api/conversations`
   - Fix: send canonical scope pair (`businessId` + `locationSlug`) for all chat/conversation calls.
- Symptom: fallback warning `[scope-fallback] legacy compatibility path used`
   - Fix: ensure `supabase db push` has applied root migrations, then re-run verification.
- Symptom: guard fails with non-authoritative migration files
   - Fix: move new SQL to `supabase/migrations/*` and remove the non-authoritative file.

## Known limitations

- Anthropic and Google provider adapters are currently placeholders and throw at runtime.
- Conversations average-response-time metric is not implemented yet.
- No automated test suite is currently configured; rely on lint/typecheck plus targeted API/page verification.

## Supabase client safety model

- Browser/client code must only use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Client helper: `apps/dashboard/src/lib/supabase/client.ts`
- User-scoped API routes should use cookie-bound server client with anon key + RLS.
   - Server helper: `apps/dashboard/src/lib/supabase/server.ts`
- Trusted backend-only write paths use service role key from server-only modules.
   - Shared helper: `packages/shared/src/supabase/server.ts`
   - Current trusted write path: chat store in `packages/shared/src/storage/supabase.ts`
   - Worker path: `scripts/worker/website-import-worker.ts`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser bundles or public env vars.
