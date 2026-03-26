export type ImportRunStatus = "queued" | "running" | "succeeded" | "failed";

export type WebsitePageType =
  | "home"
  | "menu"
  | "events"
  | "reservations"
  | "memberships"
  | "private-events"
  | "catering"
  | "contact"
  | "hours"
  | "faq"
  | "policies"
  | "about"
  | "general";

export type CrawledPage = {
  url: string;
  title: string;
  textExcerpt: string;
  structuredText?: string;
  pageType?: WebsitePageType;
  metaDescription?: string;
  headingText?: string[];
  sourceAnchorTexts?: string[];
};

export type SocialLink = {
  platform: "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "other";
  url: string;
  sourceUrl: string;
};

export type ImportSignals = {
  emails: Array<{ value: string; sourceUrl: string }>;
  phones: Array<{ value: string; sourceUrl: string }>;
  addresses: Array<{ value: string; sourceUrl: string }>;
  hours: Array<{ value: string; sourceUrl: string }>;
  bookingLinks: Array<{ url: string; label: string; sourceUrl: string; platform: string | null }>;
  socialLinks: SocialLink[];
  logoCandidates: Array<{ url: string; sourceUrl: string }>;
  faviconCandidates: Array<{ url: string; sourceUrl: string }>;
  colorCandidates: Array<{ value: string; sourceUrl: string; context?: string }>;
  fontCandidates: Array<{ value: string; sourceUrl: string }>;
};

export type ImportClaim<T> = {
  value: T | null;
  sourceUrl: string | null;
  confidence?: number;
};

export type ImportFaq = {
  id: string;
  question: string;
  answer: string;
  sourceUrl: string | null;
  include: boolean;
  confidence?: number;
  lowConfidence?: boolean;
};

export type ImportPolicy = {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string | null;
  include: boolean;
};

export type ImportEvent = {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  description: string;
  category: string;
  bookingInfo: string | null;
  bookingUrl: string | null;
  pricing: string | null;
  location: string | null;
  sourceUrl: string | null;
  recurring: boolean;
  include: boolean;
};

export type ImportMenuItem = {
  id: string;
  name: string;
  price: string | null;
  description: string;
  dietaryNotes: string | null;
  include: boolean;
};

export type MenuSemanticCategory =
  | "starters"
  | "salads"
  | "soups"
  | "entrees"
  | "seafood"
  | "kids_menu"
  | "desserts"
  | "beverages"
  | "alcohol"
  | "brunch"
  | "other";

export type ImportMenuSection = {
  id: string;
  title: string;
  /** Normalised semantic bucket — populated during ingestion, used by chat formatter */
  semanticCategory?: MenuSemanticCategory | null;
  sourceUrl: string | null;
  include: boolean;
  items: ImportMenuItem[];
};

/**
 * Three-state signal for whether reservations are available at this location.
 * - "confirmed": booking platform URL or actionable instructions were extracted.
 * - "page-exists-unconfirmed": reservation-related pages were found but no concrete booking details confirmed.
 * - "not-offered": no reservation evidence found at all.
 */
export type ReservationStatus = "confirmed" | "page-exists-unconfirmed" | "not-offered";

export type ImportReservationInfo = {
  /**
   * Three-state reservation signal. Replaces the binary `include` flag for new imports.
   * Older stored configs that lack this field should fall back to the `include` boolean.
   */
  status: ReservationStatus;
  /** @deprecated Use `status !== "not-offered"` instead. Kept for backward compat with stored configs. */
  include: boolean;
  sourceUrl: string | null;
  bookingUrl: string | null;
  platforms: string[];
  instructions: string;
  partySizeNotes: string | null;
  depositPolicy: string | null;
  experienceNotes: string | null;
};

export type ImportMembershipInfo = {
  include: boolean;
  sourceUrl: string | null;
  name: string;
  benefits: string;
  pickupDetails: string | null;
  signupUrl: string | null;
  memberEventNotes: string | null;
};

export type WebsiteImportDraft = {
  sourceUrl: string;
  pageClassification: Array<{ url: string; title: string; pageType: WebsitePageType }>;
  businessProfile: {
    name: ImportClaim<string>;
    shortDescription: ImportClaim<string>;
    phone: ImportClaim<string>;
    email: ImportClaim<string>;
    address: ImportClaim<string>;
    hours: ImportClaim<string>;
    socialLinks: SocialLink[];
  };
  faqs: ImportFaq[];
  policies: ImportPolicy[];
  restaurantKnowledge: {
    events: ImportEvent[];
    /**
     * True if any event-related pages were visited during crawl, even if no
     * confirmed dated listings were extracted. Use this to distinguish
     * "pages exist but no listings confirmed" from "no event info at all".
     */
    eventPagesPresent: boolean;
    /**
     * True only when concrete event listings with sufficient evidence (dates,
     * recurring entries, etc.) were successfully extracted.
     */
    currentEventsFound: boolean;
    menuSections: ImportMenuSection[];
    reservations: ImportReservationInfo;
    memberships: ImportMembershipInfo;
  };
  brand: {
    primaryColor: ImportClaim<string>;
    accentColor: ImportClaim<string>;
    backgroundColor: ImportClaim<string>;
    textColor: ImportClaim<string>;
    mutedTextColor?: ImportClaim<string>;
    fontFamily: ImportClaim<string>;
    logoUrl: ImportClaim<string>;
  };
  restaurantInsights?: {
    eventHighlights?: string | null;
    reservationGuidance?: string | null;
    membershipNotes?: string | null;
    menuSummary?: string | null;
  };
  evidence: {
    pages: Array<{ url: string; title: string }>;
  };
};

// ── Crawl intelligence types ──────────────────────────────────────────────────

export type LinkTier = "core" | "secondary" | "low-value";

export type KnowledgeArea =
  | "business-identity"
  | "menu"
  | "hours"
  | "contact-location"
  | "reservations"
  | "events"
  | "service-notes"
  | "special-programs";

export type KnowledgeCoverage = {
  area: KnowledgeArea;
  found: boolean;
  confidence: "high" | "medium" | "low" | "none";
  sourcePages: string[];
};

export type SiblingEntity = {
  name: string;
  probableUrl: string;
  reason: string;
};

export type CrawlReport = {
  knowledgeCoverage: KnowledgeCoverage[];
  includedPages: Array<{ url: string; title: string; pageType: string; tier: LinkTier }>;
  excludedLinks: Array<{ url: string; anchorText: string; reason: string }>;
  siblingEntities: SiblingEntity[];
  stoppingReason: string;
};

export type WebsiteImportResult = {
  pages: CrawledPage[];
  signals: ImportSignals;
  draft: WebsiteImportDraft;
  crawlReport?: CrawlReport;
};

export type WebsiteImportRunRecord = {
  id: string;
  locationId: string;
  url: string;
  status: ImportRunStatus;
  error: string | null;
  errorCode?: string | null;
  source: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  appliedAt: string | null;
  pages: CrawledPage[];
  signals: ImportSignals;
  result: WebsiteImportDraft | null;
};
