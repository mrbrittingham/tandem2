# Tandem 2.0 Monorepo

This repo hosts the Tandem chatbot surface plus future dashboard, docs, and Supabase infra under one npm workspaces roof. The guiding rule is simple: all backend logic ships as Next.js App Router route handlers—no ad-hoc servers or CORS proxies.

## Structure
- apps/chatbot – customer-facing widget host (Next.js App Router)
- apps/dashboard – reserved for future operator tooling
- packages/shared – cross-cutting types and utilities
- packages/ui-kit – React components consumed by Tandem surfaces
- supabase, docs – storage for backend schema + documentation (to come)

## Development
1. Install deps: `npm install`
2. Run the chatbot locally: `npm run dev`
3. Lint the app: `npm run lint`
4. Typecheck: `npm run typecheck`

Keep changes incremental, prefer shared packages over duplicate code, and remember that APIs live exclusively in `apps/chatbot/app/api/*`.
