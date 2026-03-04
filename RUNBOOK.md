# Tandem Runbook

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

## Local development

- Start app: `npm run dev` (dashboard on `http://localhost:3100`)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Clean stale build artifacts: `npm run clean`

## Supabase workflow (authoritative)

This repo uses `supabase/migrations/*` as the migration source used by CLI push commands.

### Link to remote project
- `supabase link --project-ref <project_ref>`

### Push migrations
- `supabase db push`

### Check migration status
- `supabase migration list`

### Migration guard (required)
- `npm run guard:migrations`
- This fails if any new SQL files are added in non-authoritative migration folders.

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
