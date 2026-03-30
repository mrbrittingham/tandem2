# Knowledge System Redesign

**Status:** Phase 1 complete — model + normalization layer  
**Date:** March 2026

---

## The Problem with Q&A-First Knowledge

The current pipeline converts website content into `ImportFaq[]` rows via LLM extraction and heuristic scoring. A typical restaurant website scan produces **50–150 FAQ items**. This creates serious problems:

### Why it's broken

| Symptom | Root Cause |
|---|---|
| 100+ Q&A rows per restaurant | Every page section becomes Q&A candidates |
| Duplicate questions | "How do I reserve a table?" appears 5 different ways |
| Conflicting answers | Same topic extracted from multiple pages with different wording |
| Stale events/specials treated as permanent | No expiry lifecycle on any item |
| Poor review UX | Operators can't meaningfully review 100+ rows |
| LLM confusion | 20 injected FAQ rows conflict with structured blocks in the same prompt |

### The structural flaw

The FAQ extraction fires on **all content**, including pages that already have dedicated structured blocks:
- Reservation pages → already captured in `ImportReservationInfo`
- Menu pages → already in `ImportMenuSection[]`
- Event pages → already in `ImportEvent[]`
- Hours/contact → already in `businessProfile.signals`

So the FAQ list ends up duplicating structured data in an inferior, untyped form — and the LLM gets both, causing contradictions.

---

## The New Direction: Structured Knowledge Blocks

Instead of "approve Q&A pairs," operators now review **typed knowledge blocks**:

| Block Type | Stability | Examples |
|---|---|---|
| `business_profile` | Stable | Name, tagline, cuisine, logo, social links |
| `hours` | Semi-dynamic | Operating hours, seasonal overrides |
| `reservations` | Semi-dynamic | Booking platform, instructions, walk-in policy |
| `menu_sections` + `menu_items` | Semi-dynamic | Sections with items, prices, images |
| `events` | **Volatile** | Dated events with expiry timestamps |
| `policies` | Stable | Dress code, pets, group policy, etc. |
| `behavior` | Stable | Tone, escalation rules, conversion goals |
| `scan_suggestions` | Volatile | Pending changes from latest scan |

Each block type maps cleanly to a review screen. Instead of reviewing 100 rows, an operator reviews **7–10 typed blocks**.

---

## Categories Introduced

### Normalization categories (used during import)

These are the canonical "buckets" that FAQ candidates are routed to during normalization. Content mapped to any of these categories is **dropped from the FAQ list** if a corresponding structured block exists:

- `hours` — always covered by businessProfile signals
- `reservations` — covered by `ImportReservationInfo`
- `contact` — covered by businessProfile signals
- `location` — covered by businessProfile signals
- `menu` — covered by `ImportMenuSection[]`
- `events` — covered by `ImportEvent[]`
- `policies` — should go into structured `PolicyItem[]`, not FAQ

### Topics that CAN survive as FAQs

Only genuinely unique one-off facts without a structured home survive the normalization pass:
- Parking and accessibility specifics
- Dress code / attire policy
- Pet policy
- BYOB / corkage
- Gift cards
- Catering inquiries
- Private dining queries
- Specific dietary accommodation details

**Cap:** Maximum 15 surviving FAQs after normalization (down from 100+).

---

## Lifecycle Approach

### Volatile content (events)

Events carry:
- `start_at` — structured ISO datetime derived from `date`+`time`
- `end_at` — when the event ends
- `expires_at` — `end_at` + 48h grace period (or `date` + 24h if no end time)
- `first_seen_at` — when first imported
- `last_seen_at` — confirmed present in latest scan

Events past `expires_at` should be **archived** (flagged stale), not deleted.  
Recurring events have no hard expiry — operators must review periodically.

### Semi-dynamic content (menus, hours)

Menu items and hours blocks carry:
- `first_seen_at` — when first imported
- `last_seen_at` — last confirmed in a scan
- `overridden_by_client` — prevents scan overwrites when operator edits manually

A menu item is considered **stale** after 90 days without `last_seen_at` being refreshed. Hours overrides carry `override_end_date` and `expires_at` for auto-expiry.

### Stable content (business profile, policies, behavior)

No automatic expiry. Changes only happen via operator action or new import.

---

## Menu Image Support

Menu items now carry an `image` field in `StructuredMenuItem`:

```ts
image: {
  image_url: string;      // CDN, external URL, or local asset path
  image_alt: string | null;  // Accessibility alt text
  uploaded_at: string;    // ISO timestamp
} | null
```

And `ImportMenuItem` (the import pipeline type) carries:
- `image_url?: string | null` — URL detected from scan or set by operator
- `image_alt?: string | null` — Accessibility alt text

**Phase 1 scope:** The data model is ready. No upload UI yet.  
**Phase 2:** Build upload endpoint + menu item edit UI that lets operators attach images.

---

## Business Logo Support

`WidgetThemeSettings.logoUrl` already exists. This is the single logo reference used in the chat widget header.

`StructuredBusinessProfile` carries an extended logo block:
```ts
logo_url: string | null
logo_uploaded_at: string | null
logo_width: number | null    // hint for display optimization
logo_height: number | null
```

Recommended specs (enforced in upload UI — Phase 2):
- Minimum: 512×512px
- Formats: PNG or SVG preferred
- Aspect ratio: square or horizontal (no portrait)
- Background: transparent PNG preferred

**Phase 2:** Wire upload endpoint to store logo, set both `StructuredBusinessProfile.logo_url` and `WidgetThemeSettings.logoUrl` in a single operation.

---

## What Changed in Phase 1

### New files

| File | Purpose |
|---|---|
| `packages/shared/src/structured-knowledge.ts` | Full typed model for all structured knowledge blocks including lifecycle, images, and logo support |
| `apps/dashboard/src/lib/website-import/knowledge-normalizer.ts` | Normalization utilities: FAQ deduplication, structured-block coverage check, lifecycle helpers |

### Modified files

| File | Change |
|---|---|
| `packages/shared/src/types.ts` | Added logo spec comments to `WidgetThemeSettings.logoUrl` |
| `packages/shared/src/client/index.ts` | Export `structured-knowledge` types |
| `apps/dashboard/src/lib/website-import/types.ts` | Added lifecycle fields to `ImportEvent`; image + lifecycle fields to `ImportMenuItem` |
| `apps/dashboard/src/lib/website-import/apply.ts` | Wired normalizer into `buildKnowledgeImportPayload`; added lifecycle timestamps to events and menu items on apply |

---

## What the Normalizer Does

`normalizeImportFaqs(faqs, structuredBlocks)` in `knowledge-normalizer.ts`:

1. **Drops structured-block topics** — FAQ candidates whose question/answer matches reservations, menu, events, hours, or contact patterns are dropped if the corresponding block has data
2. **Drops low-quality** — items below score threshold (< 4) are discarded
3. **Deduplicates** — semantically similar questions (70%+ word overlap) are collapsed to the highest-scored version
4. **Caps output** — at most 15 FAQs survive regardless of input size
5. **Logs stats** — normalization summary is logged and stored in `faqNormalizationStats` in the knowledge config

Expected reduction for a typical restaurant scan:
- Before: 50–150 FAQ items
- After: 5–15 genuine policy/info items

---

## What Comes Next (Phase 2)

### UI redesign
- Replace the FAQ accordion list on `/knowledge` with structured block editors
- One card per block type (hours, menu, events, reservations, policies)
- Each event card shows its `expires_at` with an expiry warning badge
- Stale menu items flagged with a "last seen N days ago" indicator

### Scan suggestions review
- `ScanSuggestion[]` from the model gets a dedicated review panel
- Operators see proposed additions/updates from the latest scan
- One-click approve/reject per suggestion
- Auto-expires after 30 days if not reviewed

### Image upload
- Upload endpoint for menu item images → sets `StructuredMenuItem.image`
- Upload endpoint for business logo → sets both `StructuredBusinessProfile.logo_url` and `WidgetThemeSettings.logoUrl`

### Migration
- Existing `structuredWebsiteKnowledge` consumers migrated to `LocationStructuredKnowledge`
- Legacy `importedFaqs` deprecated once normalization proves stable in production

### Expiry notifications
- Dashboard indicator when events are approaching expiry
- Warning when menu items haven't been seen in 60+ days
- Hours override auto-expiry surfaced in the UI

---

## Non-Goals (Explicitly out of scope)

- General media library
- Full CMS for all content
- Image CDN or asset management system
- Multi-image support per menu item
- Video support
