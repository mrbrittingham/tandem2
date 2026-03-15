# Tandem 2.0 Product Upgrade Plan

## Information Architecture
### Widget (end users)
1. Chat tab
   - Welcome card (business name, description)
   - Suggested intents (chips) + "Talk to a person" CTA
   - Conversation stream + input
2. Help tab
   - Search input
   - Featured categories list (FAQ grouping)
   - FAQ items with "Ask about this" action

### Admin Dashboard (operators)
1. Overview (status, next steps, quick links)
2. Businesses (list + create wizard)
3. Knowledge (FAQs, policies, menu/docs)
4. Intents & Flows (popular intents, routing)
5. Handoff (hours, contact methods, fallback copy)
6. Widget (theme + preview + install snippet)
7. Integrations (POS/reservation placeholders)

## Key User Flows
1. First-time onboarding
   - Create business wizard → theme preview → install instructions.
2. Knowledge setup
   - Add categories, FAQs, policies with show-in-help toggle.
3. Intent management
   - CRUD intents with template defaults and routing type.
4. Handoff configuration
   - Define live support hours, channels, fallback messaging.
5. Widget preview
   - Update widget demo from stored config (business info, intents, FAQs).

## Copy Principles
- Plain-language, action-driven microcopy ("Add FAQ", "Save changes").
- Reference customer value ("Help guests find answers") not technical details.
- Keep tone neutral, concise, and industry-agnostic.
- Use consistent nouns (business, concierge, help center).

## Implementation Order
1. Mock data layer in `packages/shared` (types + in-memory store + hooks).
2. Dashboard skeleton navigation + layout tying into store.
3. Businesses onboarding wizard + overview state.
4. Knowledge + Intents CRUD screens referencing store.
5. Handoff + Widget theme/install flows (including copy buttons).
6. Wire widget (ui-kit + dashboard preview) to shared store config; update UX (tabs, help, intents, handoff entry).
7. Polish copy, empty states, and add DEV note with instructions.
