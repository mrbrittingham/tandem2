/**
 * Structured Knowledge Model for Tandem
 *
 * This module defines the canonical structured knowledge types that replace
 * the flat FAQ/Q&A approach. Instead of 100+ Q&A rows, restaurant knowledge
 * is stored as typed, lifecycle-aware blocks that are easier to review,
 * harder to corrupt, and safer for time-sensitive data.
 *
 * Design principles:
 * - Stable facts (name, location, cuisine) exist in business_profile
 * - Semi-dynamic facts (menus, hours, reservations) live in typed blocks
 * - Volatile facts (events, specials) carry explicit lifecycle fields
 * - All blocks carry source attribution so operators know where data came from
 * - FAQs are preserved as a legacy/overflow bucket, not the primary channel
 *
 * Phase 1 scope: models only — no full UI redesign yet.
 * TODO Phase 2: UI editor for each block type, scan_suggestions review flow
 * TODO Phase 3: expiry notifications, auto-archival, stale-content warnings
 */

// ── Shared lifecycle fields ────────────────────────────────────────────────

/**
 * Standard lifecycle metadata carried by volatile and semi-dynamic knowledge.
 * Not all fields are required for every type — see each type for which apply.
 */
export type KnowledgeLifecycle = {
  /** ISO timestamp when this record was first created/imported */
  first_seen_at: string;
  /** ISO timestamp when this record was last confirmed present in a scan */
  last_seen_at: string;
  /**
   * ISO timestamp after which this record should be treated as expired.
   * For events: typically end_at + a short grace period (e.g. 48h).
   * For menu items: null unless the operator marks it seasonal.
   * For hours overrides: the last day of the override window.
   */
  expires_at: string | null;
  /**
   * Confidence level from the extraction pass.
   * "high" = extracted from structured/explicit data
   * "medium" = inferred from context with reasonable evidence
   * "low" = speculative, requires operator review
   */
  confidence: "high" | "medium" | "low";
  /**
   * Current review state.
   * "pending" = newly imported, awaiting operator review
   * "approved" = operator confirmed this is correct
   * "rejected" = operator dismissed this (will not resurface)
   * "stale" = system flagged as possibly out of date
   */
  review_status: "pending" | "approved" | "rejected" | "stale";
  /** URL this data was extracted from */
  source_url: string | null;
  /**
   * If true, operator has manually edited this record.
   * Prevents scan passes from overwriting it automatically.
   */
  overridden_by_client: boolean;
  /**
   * ID of the record that supersedes this one (for deduplication).
   * When set, this record should be treated as a duplicate/old version.
   */
  superseded_by: string | null;
};

// ── Business Profile ───────────────────────────────────────────────────────

/**
 * Core business identity — stable facts that rarely change.
 * Stability: STABLE
 *
 * Logo support is intentionally limited:
 * - logo_url: URL to the uploaded/detected logo asset
 * - logo_uploaded_at: when the logo was last set
 * - logo_width / logo_height: optional metadata for display hints
 *
 * Recommended logo specs (comment for future upload UI):
 * - Minimum: 512×512px
 * - Formats: PNG or SVG preferred (JPG acceptable)
 * - Aspect ratio: square or horizontal (avoid portrait)
 * - Background: transparent PNG preferred for widget overlay use
 *
 * TODO Phase 2: Add upload endpoint and asset reference type
 */
export type StructuredBusinessProfile = {
  /** Internal record ID */
  id: string;
  /** Display name of the business */
  name: string;
  /** Short tagline or cuisine description */
  tagline: string | null;
  /** 1–3 sentence description used in chat system prompt */
  summary: string | null;
  /** Primary cuisine or service style (e.g. "American, farm-to-table") */
  cuisine_style: string | null;
  /** Business/location slug for URL routing */
  slug: string;

  // Contact
  phone: string | null;
  email: string | null;
  address: string | null;
  website_url: string | null;

  // Logo — limited to single logo per Phase 1 scope
  logo_url: string | null;
  logo_uploaded_at: string | null;
  /** Optional width in pixels for display optimization */
  logo_width: number | null;
  /** Optional height in pixels for display optimization */
  logo_height: number | null;

  // Social
  social_links: Array<{
    platform: string;
    url: string;
  }>;

  // Meta
  created_at: string;
  updated_at: string;
};

// ── Hours ──────────────────────────────────────────────────────────────────

/**
 * Operating hours block — semi-dynamic (changes a few times per year).
 * Stability: SEMI-DYNAMIC
 *
 * Supports both regular schedules and time-bounded overrides (holiday hours,
 * temporary closures, seasonal schedule changes).
 */
export type StructuredHoursBlock = {
  id: string;
  /** Human-readable label (e.g. "Winter Hours", "Holiday Schedule") */
  label: string;
  /** Days this block applies to */
  days: string[];
  /** Opening time in HH:mm 24h format or display string like "11:00 AM" */
  open: string;
  /** Closing time */
  close: string;
  /** If true, the location is closed during this period (closed all day) */
  closed_all_day: boolean;
  /**
   * If set, this block only applies within the given date range.
   * Used for holiday overrides, seasonal closures, etc.
   * Regular hours have no date range.
   */
  override_start_date: string | null;
  /** ISO date string — the last day this override is in effect */
  override_end_date: string | null;
  /**
   * After this date (ISO), the override expires and regular hours apply.
   * Typically = override_end_date or override_end_date + 1 day.
   */
  expires_at: string | null;
  /** Source URL where hours were extracted from */
  source_url: string | null;
  overridden_by_client: boolean;
  review_status: "pending" | "approved" | "stale";
};

// ── Reservations ──────────────────────────────────────────────────────────

/**
 * Reservation system info — semi-dynamic.
 * Stability: SEMI-DYNAMIC
 */
export type StructuredReservations = {
  id: string;
  /**
   * "confirmed" = booking URL or explicit instructions found
   * "page-exists-unconfirmed" = reservation page found, no confirmed details
   * "not-offered" = no reservation evidence at all
   */
  status: "confirmed" | "page-exists-unconfirmed" | "not-offered";
  booking_url: string | null;
  /** Platforms detected (e.g. ["opentable", "resy"]) */
  platforms: string[];
  /** Human-readable booking instructions */
  instructions: string;
  party_size_notes: string | null;
  deposit_policy: string | null;
  experience_notes: string | null;
  source_url: string | null;
  overridden_by_client: boolean;
  last_seen_at: string;
  review_status: "pending" | "approved" | "stale";
};

// ── Menu ──────────────────────────────────────────────────────────────────

/**
 * Menu item image support.
 * Kept minimal per Phase 1 scope — no generic media library.
 * Future UI should attach images here via an upload endpoint.
 *
 * TODO Phase 2: build upload UI that sets image_url on the menu item
 * TODO Phase 2: consider CDN-backed asset references with width/height stored
 */
export type MenuItemImage = {
  /** URL of the menu item image (CDN, external, or local asset path) */
  image_url: string;
  /** Alt text for accessibility */
  image_alt: string | null;
  /** ISO timestamp when this image was uploaded/attached */
  uploaded_at: string;
};

/**
 * A single menu item with image support and lifecycle tracking.
 * Stability: SEMI-DYNAMIC (items change seasonally or periodically)
 */
export type StructuredMenuItem = {
  id: string;
  /** Parent section ID */
  section_id: string;
  name: string;
  description: string;
  price: string | null;
  dietary_notes: string | null;

  // Image support — Phase 1 scope (no full media library)
  image: MenuItemImage | null;

  // Lifecycle
  /** true if this item only appears during certain seasons */
  is_seasonal: boolean;
  first_seen_at: string;
  last_seen_at: string;
  /**
   * Set to an ISO date when operator marks item as temporary.
   * System will flag as stale if not refreshed after this date.
   * null = no known expiry (permanent menu item assumed)
   */
  expires_at: string | null;
  source_url: string | null;
  overridden_by_client: boolean;
  review_status: "pending" | "approved" | "stale";
};

/**
 * Menu section container.
 * Stability: SEMI-DYNAMIC
 */
export type StructuredMenuSection = {
  id: string;
  title: string;
  /**
   * Normalized semantic bucket for chat formatting and ordering.
   * @see MenuSemanticCategory in website-import/types.ts
   */
  semantic_category: string | null;
  items: StructuredMenuItem[];
  source_url: string | null;
  /** If true, entire section is flagged as seasonal/temporary */
  is_seasonal: boolean;
  first_seen_at: string;
  last_seen_at: string;
  overridden_by_client: boolean;
  review_status: "pending" | "approved" | "stale";
};

// ── Events ────────────────────────────────────────────────────────────────

/**
 * A single event — volatile data that must carry explicit expiry.
 * Stability: VOLATILE
 *
 * Events older than expires_at should be archived, not deleted, so operators
 * can audit what was previously shown.
 */
export type StructuredEvent = {
  id: string;
  title: string;
  description: string;
  category: string;

  // Time
  /** ISO date string or display string like "March 15, 2026" */
  date: string | null;
  time: string | null;
  /** ISO datetime for structured comparison (derived from date+time if parseable) */
  start_at: string | null;
  /**
   * ISO datetime when this event ends.
   * null = single-time event with no known end, or all-day event.
   */
  end_at: string | null;
  /**
   * ISO datetime after which this event record should be treated as expired.
   * Default: end_at + 48 hours grace period, or date + 24 hours if end_at is null.
   * Recurring events: set to the last occurrence date + grace period.
   */
  expires_at: string | null;

  // Booking
  booking_url: string | null;
  booking_info: string | null;
  pricing: string | null;
  location: string | null;

  /** True if this event recurs (weekly, monthly, etc.) */
  recurring: boolean;
  /** For recurring events: human description like "Every Friday" */
  recurrence_description: string | null;

  // Lifecycle
  first_seen_at: string;
  last_seen_at: string;
  confidence: "high" | "medium" | "low";
  review_status: "pending" | "approved" | "rejected" | "stale";
  source_url: string | null;
  overridden_by_client: boolean;
  superseded_by: string | null;
};

// ── Policies ──────────────────────────────────────────────────────────────

/**
 * A policy item — stable once set, but operator-editable.
 * Stability: STABLE
 */
export type StructuredPolicy = {
  id: string;
  title: string;
  /** Policy text — 1 to a few paragraphs */
  description: string;
  /**
   * Policy category for grouping.
   * Values: "reservations" | "cancellation" | "dining" | "pets" | "dress_code" | "other"
   */
  category: string;
  first_seen_at: string;
  last_seen_at: string;
  source_url: string | null;
  overridden_by_client: boolean;
  review_status: "pending" | "approved" | "stale";
};

// ── Scan Suggestions ──────────────────────────────────────────────────────

/**
 * A pending suggestion from a scan pass — NOT yet applied to live knowledge.
 * Operators review these before they become canonical records.
 *
 * Stability: VOLATILE (exists only in queued/reviewed state)
 *
 * TODO Phase 2: build full scan suggestion review UI
 * TODO Phase 2: auto-expire suggestions older than 30 days
 */
export type ScanSuggestion = {
  id: string;
  /** The knowledge category this suggestion belongs to */
  category:
    | "hours"
    | "reservations"
    | "contact"
    | "location"
    | "menu"
    | "events"
    | "policies"
    | "business_profile";
  /**
   * What kind of change this suggestion represents.
   * "add" = new record not in current knowledge
   * "update" = modification to an existing record
   * "remove" = record not seen in latest scan (possibly removed from site)
   */
  action: "add" | "update" | "remove";
  /** Reference to the existing record being updated/removed (null for "add") */
  target_record_id: string | null;
  /** The suggested value — shape depends on category */
  suggested_value: Record<string, unknown>;
  /** The value before the suggested change (for "update" and "remove") */
  previous_value: Record<string, unknown> | null;
  /** Source URL this suggestion came from */
  source_url: string | null;
  confidence: "high" | "medium" | "low";
  /** ISO timestamp when this suggestion was created */
  created_at: string;
  /**
   * After this date the suggestion auto-archives if not reviewed.
   * Default: created_at + 30 days
   */
  expires_at: string;
  /**
   * Current operator decision.
   * "pending" = awaiting review
   * "accepted" = applied to live knowledge
   * "rejected" = dismissed
   */
  decision: "pending" | "accepted" | "rejected";
};

// ── Behavior / Assistant Rules ─────────────────────────────────────────────

/**
 * Assistant persona and behavior rules — stable operator-authored config.
 * Stability: STABLE
 */
export type StructuredBehaviorConfig = {
  /** Tone and voice description for the LLM prompt */
  tone_voice: string;
  /**
   * Topics the assistant should confidently answer.
   * Replaces the free-text "shouldAnswer" field.
   */
  should_answer: string;
  /**
   * Topics the assistant must NOT address.
   */
  should_avoid: string;
  /** Instructions for when to escalate to human staff */
  escalation_instructions: string;
  /**
   * Conversion goals — actions to nudge users toward.
   * e.g. ["Book a table", "Call location"]
   */
  conversion_goals: string[];
};

// ── Top-level container ────────────────────────────────────────────────────

/**
 * The complete structured knowledge block for a location.
 * Replaces the flat FAQ-first approach.
 *
 * This is stored in business_location_configs.knowledge_config under
 * the key "structuredKnowledge" (alongside the legacy "structuredWebsiteKnowledge"
 * for backward compatibility during the transition).
 *
 * TODO Phase 2: migrate "structuredWebsiteKnowledge" consumers to this type
 * TODO Phase 2: deprecate and remove importedFaqs once normalization is complete
 */
export type LocationStructuredKnowledge = {
  /** Business profile data for this location */
  business_profile: Partial<StructuredBusinessProfile>;
  /** Regular and override hours blocks */
  hours: StructuredHoursBlock[];
  /** Reservation system info */
  reservations: StructuredReservations | null;
  /** Menu sections and items */
  menu_sections: StructuredMenuSection[];
  /** Events — carries explicit expiry */
  events: StructuredEvent[];
  /** Policy items */
  policies: StructuredPolicy[];
  /** Behavior / persona config */
  behavior: Partial<StructuredBehaviorConfig>;
  /**
   * Pending scan suggestions awaiting operator review.
   * These are not yet live — stored here until Phase 2 review UI exists.
   */
  scan_suggestions: ScanSuggestion[];
  /** ISO timestamp of the last scan that produced this knowledge */
  last_synced_at: string | null;
};

// ── Lifecycle utilities ────────────────────────────────────────────────────

const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours in ms

/**
 * Compute expires_at for an event given its date/time strings.
 * Returns null if no date is available.
 */
export function computeEventExpiresAt(date: string | null, endAt: string | null): string | null {
  if (endAt) {
    try {
      const end = new Date(endAt);
      if (!isNaN(end.getTime())) {
        return new Date(end.getTime() + GRACE_PERIOD_MS).toISOString();
      }
    } catch {
      // fall through
    }
  }
  if (date) {
    // Parse "Month DD, YYYY" or "Month DD" patterns
    const parsed = Date.parse(date);
    if (!isNaN(parsed)) {
      return new Date(parsed + GRACE_PERIOD_MS).toISOString();
    }
  }
  return null;
}

/**
 * Returns true if the event has a known expiry that has passed.
 */
export function isEventExpired(event: Pick<StructuredEvent, "expires_at">, now?: Date): boolean {
  if (!event.expires_at) return false;
  const expiry = new Date(event.expires_at);
  if (isNaN(expiry.getTime())) return false;
  return expiry < (now ?? new Date());
}

/**
 * Returns true if a menu item should be flagged as stale.
 * Criteria: last_seen_at is older than staleDaysThreshold days AND
 * the item is not operator-overridden.
 */
export function isMenuItemStale(
  item: Pick<StructuredMenuItem, "last_seen_at" | "overridden_by_client">,
  staleDaysThreshold = 90,
  now?: Date,
): boolean {
  if (item.overridden_by_client) return false;
  const lastSeen = new Date(item.last_seen_at);
  if (isNaN(lastSeen.getTime())) return false;
  const cutoff = new Date((now ?? new Date()).getTime() - staleDaysThreshold * 24 * 60 * 60 * 1000);
  return lastSeen < cutoff;
}

/**
 * Returns true if an hours override has expired.
 */
export function isHoursOverrideExpired(
  block: Pick<StructuredHoursBlock, "override_end_date" | "expires_at">,
  now?: Date,
): boolean {
  const ref = block.expires_at ?? block.override_end_date;
  if (!ref) return false;
  const expiry = new Date(ref);
  if (isNaN(expiry.getTime())) return false;
  return expiry < (now ?? new Date());
}
