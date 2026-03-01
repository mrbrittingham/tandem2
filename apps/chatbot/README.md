## Chatbot App

This folder contains the Tandem customer-facing chatbot experience, built with the Next.js App Router.

### Run from the monorepo root
```bash
npm run dev            # starts apps/chatbot
npm run lint           # lints via workspace delegation
npm run typecheck      # type-checks shared/ui-kit/chatbot
npm --workspace apps/chatbot run build
```

### Run from this folder
```bash
npm install            # only needed when working outside the root
npm run dev            # next dev
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run build          # production build
```

All backend logic must live in `app/api/*` route handlers—do not create standalone servers.
