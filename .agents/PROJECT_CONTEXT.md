# Tandem Project Context

## What Tandem is
Tandem is an AI concierge platform for restaurants.
It includes:
- a public-facing chatbot widget
- an operator dashboard
- a website import pipeline
- shared logic for chat behavior, business data, and configuration

## Core stack
- Next.js App Router
- TypeScript
- Supabase
- Vercel AI SDK / LLM integrations
- worker-based website import flow

## Current priorities
- make chatbot behavior more natural
- improve website import accuracy and structure
- keep UI clean and practical
- prefer small safe diffs over big rewrites
- improve operator trust and clarity in AI-assisted flows

## Working style
- inspect only files relevant to the task
- do not roam the repo without reason
- do not commit unless explicitly told
- prefer minimal changes that are easy to review in VS Code
- explain exactly what changed after edits

## Important areas
- apps/dashboard/src/app
- apps/dashboard/src/components
- apps/dashboard/src/lib
- packages/ui-kit
- packages/shared
- scripts/worker
- supabase

## Role routing
- organizer = scope and assign work
- backend = APIs, workers, server logic, data flow
- frontend = widget, dashboard UI, interaction behavior
- reviewer = review risks, regressions, and over-engineering

## How to behave when uncertain
- ask which files to inspect first
- propose the smallest useful next step
- avoid broad architectural changes unless explicitly requested
