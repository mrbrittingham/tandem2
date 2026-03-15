# Knowledge Ingestion Specification

This document defines how Tandem ingests website content, transforms it into structured knowledge, and makes it available to the chatbot engine.

---

## 1. Purpose

Tandem ingests information from a customer's website and transforms it into structured knowledge that powers the AI chatbot. Rather than storing raw HTML or treating every page as unstructured text, the system classifies pages by type, extracts domain-specific data (hours, menus, contact info, events), and stores it in a structured format that the chatbot can query precisely.

This approach enables the chatbot to give accurate, specific answers ("We're open until 10 PM on Fridays") rather than generic summaries.

---

## 2. High-Level Pipeline

```
Restaurant Website
       │
       ▼
┌──────────────┐
│   Crawler    │  Fetch reachable pages from the target site
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Page      │  Categorize each page by type (menu, events, FAQ, etc.)
│Classification│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Content    │  Extract structured data from classified pages
│  Extraction  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Knowledge   │  Normalize extracted data into typed records
│ Structuring  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Supabase   │  Persist as JSONB in business_location_configs
│   Storage    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Chatbot    │  Retrieve structured knowledge for LLM context
│  Retrieval   │
└──────────────┘
```

---

## 3. Crawler Responsibilities

The crawler (`scripts/worker/website-import-worker.ts` + `apps/dashboard/src/lib/website-import/`) is responsible for:

- **Crawling reachable pages** — starting from the provided URL, follow internal links to discover site content.
- **Respecting crawl limits** — cap the number of pages fetched to avoid excessive resource usage.
- **Avoiding infinite loops** — track visited URLs to prevent re-crawling the same page.
- **Detecting page types** — identify whether a page contains menus, events, reservations, FAQs, contact information, policies, or general content.
- **Extracting structured information** — pull out specific data points (email addresses, phone numbers, business hours, physical addresses) where possible.
- **Handling errors gracefully** — skip unreachable pages without failing the entire import run.

### Job lifecycle

| Status | Meaning |
|--------|---------|
| `queued` | Import requested, waiting for worker |
| `running` | Worker has claimed the job and is crawling |
| `succeeded` | Crawl and extraction complete, draft available |
| `failed` | An error occurred during processing |

---

## 4. Page Classification

Classification determines how each crawled page is processed and what extraction strategy to apply.

### Target page types

| Type | Description | Example signals |
|------|-------------|-----------------|
| **Menu** | Food and drink offerings | `/menu` URL, menu-related headings, price patterns |
| **Events** | Upcoming events, live music, specials | Date patterns, event-related headings |
| **Reservations** | Booking information | `/reservations`, booking widget embeds |
| **Contact** | Phone, email, address, hours | `/contact`, address patterns, phone numbers |
| **FAQ** | Frequently asked questions | Question/answer patterns, `/faq` URL |
| **Policies** | Cancellation, privacy, dress code | Policy-related headings, `/policy` URL |
| **About** | Business story, team, history | `/about`, narrative content |
| **General** | Other informational pages | Default classification |

### Why classification matters

Classification enables the chatbot to respond with type-appropriate answers. When a customer asks "What's on the menu?", the chatbot retrieves menu-classified knowledge rather than searching all pages generically. This produces more precise, relevant responses.

---

## 5. Structured Knowledge Model

Extracted knowledge is stored as structured records rather than raw HTML. This makes it queryable, editable by operators, and consumable by the LLM with minimal preprocessing.

### Conceptual record types

| Record type | Contents | Source pages |
|-------------|----------|--------------|
| `knowledge_pages` | General page content, summaries | All page types |
| `knowledge_faq` | Question-answer pairs | FAQ pages, Q&A sections |
| `knowledge_events` | Event name, date, time, description | Events pages |
| `knowledge_menu_items` | Item name, description, price, category | Menu pages |
| `knowledge_contact_info` | Phone, email, address, hours | Contact pages |
| `knowledge_policies` | Policy name, content | Policy pages |

### Storage location

Structured knowledge is stored as JSONB within `business_location_configs.knowledge_config`, scoped by `businessId + locationSlug`. This keeps all location-specific configuration in a single row and avoids schema sprawl.

### Design principle

The goal is **structured knowledge over raw content**. Each record type has a defined shape that the chatbot can reason about directly, rather than requiring the LLM to parse HTML or infer structure from unformatted text.

---

## 6. Extraction Heuristics

The extraction layer uses multiple strategies to pull structured data from crawled pages.

### HTML semantic tags

- `<h1>`–`<h6>` for section structure
- `<address>` for physical addresses
- `<time>` for dates and times
- `<table>` for tabular data (menus, hours)
- `<ul>`/`<ol>` for list content

### Schema.org structured data

- `LocalBusiness` — name, address, phone, hours
- `Restaurant` — menu, cuisine type
- `Event` — name, date, location
- `FAQPage` — question/answer pairs

### Headings and list structures

- Detect section boundaries from heading hierarchy
- Extract list items as individual knowledge entries
- Pair headings with their content sections

### Table parsing

- Menu tables: item name, description, price columns
- Hours tables: day-of-week to open/close times
- Event tables: date, name, description rows

### Event date detection

- Parse natural language dates ("Friday, March 20th")
- Detect recurring patterns ("Every Tuesday")
- Extract time ranges ("7 PM – 10 PM")

### Menu item pattern recognition

- Price patterns ($12.99, $15)
- Item + description + price groupings
- Category headers (Appetizers, Entrées, Desserts)

---

## 7. Knowledge Refresh Strategy

Knowledge becomes stale as restaurants update their websites. The system supports multiple refresh mechanisms.

### Manual re-import

Operators can trigger a full re-crawl from the Knowledge page in the dashboard. This creates a new `onboarding_import_runs` record and repeats the full pipeline. The operator reviews the new draft before applying it.

### Scheduled recrawl

A future enhancement: periodic recrawl jobs that automatically check for content changes. Scheduled recrawls would produce drafts for operator review rather than auto-applying changes.

### Change detection

A future enhancement: lightweight checks that detect whether key pages have changed since the last crawl, avoiding unnecessary full re-imports. This could use HTTP `Last-Modified` headers, content hashing, or targeted page fetches.

---

## 8. Chatbot Retrieval Layer

The chatbot retrieves knowledge from the structured store to build LLM context for each conversation.

### Structured lookup

For specific queries (events, menus, hours), the chatbot performs typed lookups:

- "What events are coming up?" → retrieve `knowledge_events` records
- "What's on the menu?" → retrieve `knowledge_menu_items` records
- "What are your hours?" → retrieve `knowledge_contact_info` records

### Semantic search

For general questions that don't map to a specific record type, the chatbot searches across all knowledge entries for relevant content. Currently this is keyword/context-based; future versions may use embedding-based semantic search.

### Fallback to conversational reasoning

When no matching knowledge is found, the chatbot falls back to general conversational reasoning using the LLM's base knowledge, with guardrails to avoid fabricating business-specific facts.

### Context assembly

The chat handler (`packages/shared/src/server/chat-handler.ts`) assembles the LLM prompt from:

1. System instructions (from `assistant_config`)
2. Knowledge context (from `knowledge_config`)
3. Recent conversation history (latest 50 messages)

This assembled context is sent to the configured LLM provider via `llmStream()`.

---

## 9. Operator Controls

The dashboard provides operators with full visibility and control over their knowledge base.

### Available controls

| Action | Location | Description |
|--------|----------|-------------|
| **Trigger re-crawl** | Knowledge page | Start a new website import to refresh knowledge |
| **Review detected content** | Knowledge page | View the extracted draft before applying |
| **Edit knowledge entries** | Knowledge page | Modify extracted data (fix errors, add details) |
| **Disable incorrect knowledge** | Knowledge page | Remove or deactivate entries the chatbot should not use |
| **Apply import draft** | Knowledge page | Merge reviewed draft into the active knowledge config |

### Review workflow

1. Operator triggers import or re-import
2. System crawls, classifies, and extracts
3. Draft appears on the Knowledge page for review
4. Operator edits, approves, or rejects entries
5. Approved draft is applied to `business_location_configs.knowledge_config`

This human-in-the-loop design ensures the chatbot never serves unreviewed or incorrect information.

---

## 10. Future Improvements

### Embedding search

Replace keyword-based knowledge lookup with vector embeddings for more accurate semantic matching. This would improve the chatbot's ability to find relevant knowledge for ambiguous or conversational queries.

### Vector databases

Introduce a dedicated vector store (e.g., pgvector in Supabase) for knowledge embeddings, enabling efficient similarity search across large knowledge bases.

### Automatic structured schema detection

Use LLM analysis to automatically detect the schema of a website's content (e.g., recognizing that a page contains a menu table) and generate extraction rules dynamically.

### Multi-site knowledge sources

Support ingesting knowledge from multiple sources beyond the primary website — social media profiles, review sites, third-party menu platforms — to build a more complete knowledge base.

### Incremental updates

Rather than full re-crawls, detect and process only pages that have changed since the last import, reducing processing time and operator review burden.

### Confidence scoring

Assign confidence scores to extracted knowledge entries, flagging low-confidence extractions for operator review while auto-approving high-confidence ones.
