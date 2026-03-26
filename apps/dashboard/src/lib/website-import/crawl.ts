import type { CrawledPage, CrawlReport, ImportSignals, KnowledgeArea, KnowledgeCoverage, LinkTier, SiblingEntity, SocialLink } from "./types";
import { classifyPageType } from "./extract";
import {
  WEBSITE_IMPORT_LIMITS,
  decodeHtml,
  excerptText,
  extractTitle,
  htmlToStructuredText,
  htmlToText,
  isSameDomain,
  linkPriorityScore,
  looksLikeBinaryAsset,
  normalizeCandidateUrl,
  normalizeHexColor,
  normalizeWebsiteUrl,
} from "./utils";

type CrawlResult = {
  pages: CrawledPage[];
  signals: ImportSignals;
  crawlReport: CrawlReport;
};

type LinkCandidate = {
  url: string;
  score: number;
  depth: number;
  anchorText: string;
  sourceSection: "nav" | "header" | "footer" | "button" | "content";
  /** Tier assigned during navigation-first classification phase */
  tier: LinkTier;
};

// ── Link classification rules ─────────────────────────────────────────────────
// Applied AFTER normalizeCrawlUrl pre-filtering. These catch semantically
// irrelevant pages that pass URL/junk checks but are not restaurant knowledge.

/** Anchor text patterns that reliably indicate LOW VALUE links */
const LOW_VALUE_ANCHOR_REGEX = /\b(login|sign[\s-]?in|employee\s+portal|staff\s+portal|admin|site\s*map|privacy\s+policy|terms\s+of\s+(use|service)|cookie\s+policy|accessibility\s+statement?|careers?|jobs?|hiring|press\s+kit|media\s+kit|newsroom|newsletter|subscribe|gift\s+registry|wish\s*list|my\s+account|order\s+history)\b/i;

/** URL path patterns for LOW VALUE pages */
const LOW_VALUE_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\/(?:login|sign-?in|signin|employee|staff-?portal)\b/, reason: "employee/login portal" },
  { pattern: /\/(?:sitemap(?:\.xml)?|xmlsitemap|robots\.txt?)\b/, reason: "sitemap artifact" },
  { pattern: /\/(?:press|media-?kit|newsroom|press-?room)\b/, reason: "press/media page" },
  { pattern: /\/(?:job[s]?|career[s]?|hiring|work-?(?:with|for)-?us|join-?(?:our-?)?team)\b/, reason: "jobs/careers page" },
  { pattern: /\/(?:blog|news|article[s]?|post[s]?|journal|updates?)\b/, reason: "blog/news content" },
  { pattern: /\/(?:tag|author|feed)\b/, reason: "blog taxonomy page" },
  { pattern: /\/wp-(?:admin|login|json|content\/plugins)\b/, reason: "WordPress admin artifact" },
  { pattern: /\/accessibility\b/, reason: "accessibility statement" },
  { pattern: /\/(?:legal|disclaimer|copyright)\b/, reason: "legal-only page" },
  { pattern: /\/(?:unsubscribe|email-?preferences)\b/, reason: "email management page" },
];

/** URL path patterns for CORE pages (high restaurant knowledge value) */
const CORE_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\/(?:menus?|food-?menu|dinner-?menu|lunch-?menu|brunch-?menu|drink-?menu|cocktail[s]?|wine-?list|bar-?menu)\b/, reason: "menu page" },
  { pattern: /\/(?:hours?|opening-?hours?|visit|tasting-?(?:room-?)?hours?)\b/, reason: "hours/visit page" },
  { pattern: /\/(?:contact(?:-?us)?|get-?in-?touch|reach-?us|find-?us|contact-?info)\b/, reason: "contact page" },
  { pattern: /\/(?:about(?:-?us)?|our-?story|our-?team|meet-?(?:the-?)?team|who-?we-?are)\b/, reason: "about page" },
  { pattern: /\/(?:reserv(?:ation[s]?)?|reserve(?:-?a-?table)?|book(?:-?a-?table)?)\b/, reason: "reservations page" },
  { pattern: /\/(?:events?|calendar|happenings?|live-?music|what[s-]?on|whats-?on|upcoming-?events?|entertainment)\b/, reason: "events page" },
  { pattern: /\/(?:catering|private-?(?:dining|events?)|group-?dining|weddings?|banquet[s]?)\b/, reason: "private dining/catering" },
  { pattern: /\/(?:faq[s]?|frequently-?asked[-_]?questions?|help[-_]?(?:center)?|policies|policy|cancellation)\b/, reason: "FAQ/policies page" },
  { pattern: /\/(?:location[s]?|directions?|find-?us|map|getting-?here)\b/, reason: "location/directions page" },
];

/** Anchor text patterns for CORE links */
const CORE_ANCHOR_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(menus?|food\s+menu|drink\s+menu|wine\s+list|cocktails?|bar\s+menu)\b/i, reason: "menu anchor" },
  { pattern: /\b(hours?|opening\s+hours?|we'?re\s+open|hours\s+of\s+operation|tasting\s+room)\b/i, reason: "hours anchor" },
  { pattern: /\b(contact(\s+us)?|get\s+in\s+touch|call\s+us|email\s+us|reach\s+us)\b/i, reason: "contact anchor" },
  { pattern: /\b(about(\s+us)?|our\s+story|our\s+team|who\s+we\s+are)\b/i, reason: "about anchor" },
  { pattern: /\b(reservations?|reserve(\s+a\s+table)?|book(\s+a\s+table|\s+now)?|make\s+a\s+reservation)\b/i, reason: "reservations anchor" },
  { pattern: /\b(events?|calendar|happenings?|live\s+music|what'?s\s+on|entertainment)\b/i, reason: "events anchor" },
  { pattern: /\b(catering|private\s+(?:dining|events?|parties)|group\s+dining|hire\s+(?:the\s+)?space)\b/i, reason: "catering/private anchor" },
  { pattern: /\b(faq[s]?|frequently\s+asked|policies|help|terms\s+(?:and\s+conditions)?)\b/i, reason: "FAQ/policies anchor" },
  { pattern: /\b(location[s]?|directions?|find\s+us|visit\s+us|get\s+here)\b/i, reason: "location anchor" },
  { pattern: /\b(dining|kitchen|food|eat|brunch|lunch|dinner|cuisine)\b/i, reason: "dining/food anchor" },
];

/** URL path patterns for SECONDARY pages (useful but not essential) */
const SECONDARY_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\/(?:gallery|photos?|images?|media(?!-kit))\b/, reason: "photo gallery" },
  { pattern: /\/(?:live-?cam|webcam)\b/, reason: "live camera" },
  { pattern: /\/(?:(?:wine-?)?club|membership|loyalty|join(?:-?(?:us|now))?)\b/, reason: "membership/club" },
  { pattern: /\/(?:seasonal|specials?|features?|daily-?(?:specials?)?)\b/, reason: "seasonal content" },
  { pattern: /\/(?:gift-?cards?|gift-?vouchers?|egift)\b/, reason: "gift cards" },
  { pattern: /\/(?:takeout|take-?out|to-?go|delivery|order-?online|pickup)\b/, reason: "online ordering" },
  { pattern: /\/(?:dogs?|pets?|dog-?friendly|pet-?friendly|outdoor|patio|deck)\b/, reason: "amenity info" },
];

/**
 * Classify a discovered link into a crawl tier based on URL path and anchor text.
 * Returns tier + human-readable reason for logging.
 *
 * Priority order: LOW_VALUE_ANCHOR → LOW_VALUE_PATH → CORE_PATH → CORE_ANCHOR → SECONDARY → low-value default
 */
function classifyLinkTier(url: string, anchorText: string): { tier: LinkTier; reason: string } {
  const urlLower = url.toLowerCase();
  const anchorLower = anchorText.toLowerCase().trim();

  // Anchor text is fast and high-precision for low-value signals
  if (anchorLower.length > 0 && LOW_VALUE_ANCHOR_REGEX.test(anchorLower)) {
    return { tier: "low-value", reason: `low-value anchor: "${anchorLower.slice(0, 50)}"` };
  }

  // URL path → low value
  for (const rule of LOW_VALUE_PATH_PATTERNS) {
    if (rule.pattern.test(urlLower)) {
      return { tier: "low-value", reason: rule.reason };
    }
  }

  // URL path → core
  for (const rule of CORE_PATH_PATTERNS) {
    if (rule.pattern.test(urlLower)) {
      return { tier: "core", reason: rule.reason };
    }
  }

  // Anchor text → core
  if (anchorLower.length > 0) {
    for (const rule of CORE_ANCHOR_PATTERNS) {
      if (rule.pattern.test(anchorLower)) {
        return { tier: "core", reason: rule.reason };
      }
    }
  }

  // URL path → secondary
  for (const rule of SECONDARY_PATH_PATTERNS) {
    if (rule.pattern.test(urlLower)) {
      return { tier: "secondary", reason: rule.reason };
    }
  }

  // No strong restaurant signal → low value by default
  return { tier: "low-value", reason: "no restaurant-relevant signal in URL or anchor" };
}

// ── Navigation-first discovery ─────────────────────────────────────────────────

type NavLinkSource = "header-nav" | "footer-nav" | "mobile-nav" | "cta" | "body-nav";

type NavDiscoveredLink = {
  url: string;
  anchorText: string;
  source: NavLinkSource;
};

function extractLinksFromHtmlBlock(
  block: string,
  pageUrl: string,
  source: NavLinkSource,
  out: NavDiscoveredLink[],
): void {
  const hrefPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(block)) !== null) {
    const href = match[1] ?? "";
    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized || looksLikeBinaryAsset(normalized)) continue;
    const anchorText = decodeHtml((match[2] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (anchorText.length < 1) continue;
    out.push({ url: normalized, anchorText, source });
  }
}

/**
 * Navigation-first link discovery: extract links specifically from structured
 * navigation zones (header, nav, footer, mobile menu, prominent CTAs).
 *
 * Returns unique links tagged with their navigation source so classification
 * and logging can explain where each link was found.
 */
function extractNavigationLinks(html: string, pageUrl: string): NavDiscoveredLink[] {
  const discovered: NavDiscoveredLink[] = [];

  // Header navigation
  const headerPattern = /<header[^>]*>([\s\S]*?)<\/header>/gi;
  let m: RegExpExecArray | null;
  while ((m = headerPattern.exec(html)) !== null) {
    extractLinksFromHtmlBlock(m[1] ?? "", pageUrl, "header-nav", discovered);
  }

  // All <nav> elements — check for mobile-specific attributes
  const navPattern = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
  while ((m = navPattern.exec(html)) !== null) {
    // Look at opening tag context to detect mobile/hamburger menus
    const tagContext = html.slice(Math.max(0, m.index), m.index + 200).toLowerCase();
    const isMobile = /mobile|offcanvas|hamburger|drawer|flyout|slide|overlay|side-?menu/i.test(tagContext);
    extractLinksFromHtmlBlock(m[1] ?? "", pageUrl, isMobile ? "mobile-nav" : "body-nav", discovered);
  }

  // Footer navigation
  const footerPattern = /<footer[^>]*>([\s\S]*?)<\/footer>/gi;
  while ((m = footerPattern.exec(html)) !== null) {
    extractLinksFromHtmlBlock(m[1] ?? "", pageUrl, "footer-nav", discovered);
  }

  // Prominent CTA buttons/links (class="btn", class="button", class contains "cta")
  const ctaPattern = /<a\s[^>]*class=["'][^"']*\b(?:btn|button|cta)\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = ctaPattern.exec(html)) !== null) {
    const href = m[1] ?? "";
    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized || looksLikeBinaryAsset(normalized)) continue;
    const anchorText = decodeHtml((m[2] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (anchorText.length >= 2) {
      discovered.push({ url: normalized, anchorText, source: "cta" });
    }
  }

  return uniqueBy(discovered, (l) => l.url);
}

// ── Knowledge coverage tracking ────────────────────────────────────────────────

const ALL_KNOWLEDGE_AREAS: KnowledgeArea[] = [
  "business-identity",
  "menu",
  "hours",
  "contact-location",
  "reservations",
  "events",
  "service-notes",
  "special-programs",
];

// Areas required for "core complete" early-stopping trigger
const CORE_REQUIRED_AREAS: Set<KnowledgeArea> = new Set(["menu", "hours", "contact-location"]);

// How many total areas must be found for full-coverage early stop (alongside core)
const FULL_COVERAGE_THRESHOLD = 5;

// Crawl budget caps
const CORE_PAGE_BUDGET = 10;
const SECONDARY_PAGE_BUDGET = 3;

function initCoverage(): Map<KnowledgeArea, KnowledgeCoverage> {
  const map = new Map<KnowledgeArea, KnowledgeCoverage>();
  for (const area of ALL_KNOWLEDGE_AREAS) {
    map.set(area, { area, found: false, confidence: "none", sourcePages: [] });
  }
  return map;
}

function upgradeCoverage(
  coverage: Map<KnowledgeArea, KnowledgeCoverage>,
  area: KnowledgeArea,
  pageUrl: string,
  confidence: "high" | "medium" | "low",
): void {
  const current = coverage.get(area);
  if (!current) return;
  if (!current.sourcePages.includes(pageUrl)) {
    current.sourcePages.push(pageUrl);
  }
  current.found = true;
  const levels: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };
  if (levels[confidence] > levels[current.confidence]) {
    current.confidence = confidence;
  }
}

function updateCoverageFromPage(
  coverage: Map<KnowledgeArea, KnowledgeCoverage>,
  page: CrawledPage,
): void {
  const urlLower = page.url.toLowerCase();
  const haystack = `${page.title} ${page.textExcerpt}`.toLowerCase();
  const pageType = page.pageType ?? "general";

  // Business identity: home and about pages
  if (pageType === "home" || pageType === "about" || /^\/?$/.test(new URL(page.url).pathname)) {
    upgradeCoverage(coverage, "business-identity", page.url, pageType === "about" ? "high" : "medium");
  }

  // Menu: url contains /menu or pageType=menu; upgrade to high if prices present
  if (pageType === "menu" || /\/(?:menu|food|drink|cocktail|wine)/.test(urlLower)) {
    const hasPrices = /\$\d{1,3}|\d{1,3}\.\d{2}|\d{1,3}\s*per\s+person/.test(haystack);
    upgradeCoverage(coverage, "menu", page.url, hasPrices ? "high" : "medium");
  }

  // Hours: structured hours pattern in content
  if (pageType === "hours" || /\bhours\b.{0,50}(?:open|closed|am|pm)/.test(haystack)) {
    const hasStructured = /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b.{0,30}(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|closed)/i.test(haystack);
    upgradeCoverage(coverage, "hours", page.url, hasStructured ? "high" : "low");
  }

  // Contact/location
  if (pageType === "contact" || /\/(?:contact|location|visit|find|directions)/.test(urlLower)) {
    const hasPhone = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(haystack);
    const hasAddress = /\b\d{1,5}\s+\w{3,}(?:\s+\w{2,}){0,4}\s+(?:street|avenue|ave|road|blvd|lane|drive|dr|way)\b/i.test(haystack);
    upgradeCoverage(coverage, "contact-location", page.url, (hasPhone || hasAddress) ? "high" : "medium");
  }

  // Reservations
  if (pageType === "reservations" || /\/(?:reserv|reserve|book)|opentable|resy\.com|tock\.com/.test(urlLower)) {
    upgradeCoverage(coverage, "reservations", page.url, "medium");
  }

  // Events
  if (pageType === "events" || /\/(?:event|calendar|happen|live-music)/.test(urlLower)) {
    const hasDatedEvents = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep\w*|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}/i.test(haystack);
    upgradeCoverage(coverage, "events", page.url, hasDatedEvents ? "high" : "medium");
  }

  // Service notes: FAQ, policies, about
  if (pageType === "faq" || pageType === "policies" || pageType === "about") {
    upgradeCoverage(coverage, "service-notes", page.url, "medium");
  }

  // Special programs: catering, private events, memberships
  if (pageType === "catering" || pageType === "private-events" || pageType === "memberships") {
    upgradeCoverage(coverage, "special-programs", page.url, "medium");
  }
}

function checkEarlyStopping(coverage: Map<KnowledgeArea, KnowledgeCoverage>): string | null {
  const coreComplete = [...CORE_REQUIRED_AREAS].every((area) => {
    const cov = coverage.get(area);
    return cov?.found && cov.confidence !== "none";
  });
  const coveredCount = [...coverage.values()].filter((c) => c.found).length;

  if (coreComplete && coveredCount >= FULL_COVERAGE_THRESHOLD) {
    const missing = ALL_KNOWLEDGE_AREAS.filter((a) => !coverage.get(a)?.found);
    return `Core coverage complete (${[...CORE_REQUIRED_AREAS].join(", ")}) + ${coveredCount}/${ALL_KNOWLEDGE_AREAS.length} areas covered${missing.length ? ` — not found: ${missing.join(", ")}` : ""}`;
  }
  return null;
}

const SOCIAL_PATTERNS: Array<{ platform: SocialLink["platform"]; pattern: RegExp }> = [
  { platform: "facebook", pattern: /facebook\.com/i },
  { platform: "instagram", pattern: /instagram\.com/i },
  { platform: "tiktok", pattern: /tiktok\.com/i },
  { platform: "youtube", pattern: /youtube\.com|youtu\.be/i },
  { platform: "linkedin", pattern: /linkedin\.com/i },
  { platform: "x", pattern: /x\.com|twitter\.com/i },
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EMAIL_EXACT_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,14}\d)(?!\d)/g;
const HOURS_PATTERN = /\b(?:hours|tasting room hours|open|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[^\n]{0,180}(?:\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?\s?(?:-|–|to)\s?\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?|closed|noon)/i;
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'#\-\s]{3,80}\s(?:street|avenue|ave|boulevard|blvd|road|lane|drive|way|suite|unit|st|rd|ln|dr|ste)\.?\b[,.\s]*(?:[A-Za-z\s.]+,?\s*)?(?:[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/i;
const TRACKING_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "mc_cid", "mc_eid"]);
const JUNK_QUERY_PREFIXES = ["utm_", "oly_", "vero_", "hsa_"];
const JUNK_PATH_REGEX = /(\/tag\/|\/category\/|\/author\/|\/feed\/?$|\/wp-admin|\/wp-json|\/xmlrpc\.php|\/cart|\/checkout|\/my-account|\/search\b|\?s=|\/products\/|\/product\/|\/product-category\/|\/collections\/[^/]+\/|\/merch(?:andise)?\b|\/shop\/products?)/i;
const JUNK_FILENAME_REGEX = /\.(xml|rss|txt|csv|json)(\?|$)/i;
const BOOKING_PLATFORM_REGEX = /(opentable|resy|tock|toasttab|sevenrooms|exploretock|bookeo)/i;
// Require explicit booking/reservation language — plain "book" or "tickets" alone are too noisy
const BOOKING_LINK_HINT_REGEX = /(reserv(?:e|ation|ations)|book\s+(?:now|a\s+table|a\s+reservation)|rsvp\b|book\s+an\s+experience)/i;
const HIGH_SIGNAL_PATHS = [
  "/contact",
  "/about",
  "/faq",
  "/faqs",
  "/help",
  "/hours",
  "/visit",
  "/reservations",
  "/book",
  "/menu",
  "/menus",
  "/food-menu",
  "/dinner-menu",
  "/lunch-menu",
  "/brunch-menu",
  "/drink-menu",
  "/wine-list",
  "/cocktails",
  "/bar",
  "/food",
  "/dining",
  "/kitchen",
  "/events",
  "/calendar",
  "/what-s-on",
  "/whatson",
  "/happenings",
  "/upcoming-events",
  "/live-music",
  "/wine-club",
  "/membership",
  "/club",
  "/private-events",
  "/weddings",
  "/group-dining",
  "/catering",
  "/order-online",
  "/delivery",
  "/policies",
  "/privacy",
  "/terms",
];

function withTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

function uniqueBy<T>(items: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Words that appear in restaurant-relevant URL path segments.
// Any multi-word hyphenated path slug that contains at least one of these words
// is considered restaurant-relevant and will NOT be flagged as an off-brand page.
const RESTAURANT_PATH_WORDS = new Set([
  "menu", "food", "drink", "drinks", "event", "events", "about", "contact",
  "faq", "faqs", "hours", "reservation", "reservations", "reserve", "book",
  "booking", "private", "catering", "dining", "kitchen", "bar", "wine",
  "beer", "cocktail", "cocktails", "brunch", "lunch", "dinner", "club",
  "membership", "wedding", "weddings", "group", "groups", "happenings",
  "live", "music", "specials", "takeout", "delivery", "order", "gift",
  "happy", "hour", "patio", "outdoor", "deck", "waterfront", "kids",
  "family", "dog", "pets", "parking", "bistro", "grill", "cafe", "dine",
  "eat", "seasonal", "farm", "garden", "craft", "tap", "tasting", "cellar",
  "winery", "brewery", "distillery", "restaurant", "chef", "dining",
  "policy", "policies", "faq", "visit", "location", "directions", "gallery",
  "press", "news", "jobs", "careers", "gift", "store", "takeout", "pickup",
]);

/**
 * Returns true when a crawled page appears to be for a sibling/unrelated brand
 * rather than the target restaurant. Used to prevent cross-brand content from
 * polluting the knowledge base.
 *
 * Triggers when ALL of the following hold:
 *  1. The page is not the seed (depth >= 1)
 *  2. The URL's first path segment is a multi-word hyphenated slug (e.g. "paradise-watersports")
 *  3. None of the slug words are restaurant-relevant
 *  4. The page title contains no food/restaurant vocabulary
 */
function looksLikeOffBrandPage(url: string, depth: number, title: string): boolean {
  if (depth < 1) return false;

  const pathParts = new URL(url).pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) return false;

  const firstSegment = (pathParts[0] ?? "").toLowerCase();
  if (firstSegment.length < 4) return false;

  // Only fire on hyphenated slugs — single-word paths are usually harmless
  const segmentWords = firstSegment.split(/[-_]/);
  if (segmentWords.length < 2) return false;

  // If ANY word in the slug is restaurant-relevant, allow the page
  if (segmentWords.some((w) => RESTAURANT_PATH_WORDS.has(w))) return false;

  // If the page title contains food/restaurant vocabulary, allow the page
  const titleLower = title.toLowerCase();
  const hasFoodVocab = /\b(restaurant|bar|grill|kitchen|cafe|bistro|menu|food|dining|chef|seafood|crab|fish|beer|wine|cocktail|brunch|dinner|lunch|reserv|booking|events|catering|takeout|delivery|hours|open|closed)\b/.test(titleLower);
  if (hasFoodVocab) return false;

  return true;
}

function normalizeCrawlUrl(raw: string, baseUrl: string): string | null {
  // Reject template placeholder URIs before attempting URL parsing.
  // Covers Liquid/Mustache ({{ }}) and URL-encoded equivalents (%7B%7B).
  if (/\{[{%}]|%7[Bb]%7[Bb]|%7[Bb]%25|%25%7[Dd]/.test(raw)) {
    return null;
  }

  const normalized = normalizeCandidateUrl(raw, baseUrl);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      const lowerKey = key.toLowerCase();
      if (TRACKING_QUERY_PARAMS.has(lowerKey) || JUNK_QUERY_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) {
        url.searchParams.delete(key);
      }
    }

    if (url.search.length > 140) {
      return null;
    }

    if (url.pathname.length > 220) {
      return null;
    }

    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    url.pathname = url.pathname
      .replace(/\/index\.html?$/i, "")
      .replace(/\/default\.aspx?$/i, "");

    const lowerPath = url.pathname.toLowerCase();
    if (JUNK_PATH_REGEX.test(lowerPath) || JUNK_FILENAME_REGEX.test(lowerPath) || /\/page\/\d+/.test(lowerPath)) {
      return null;
    }

    if (url.pathname === "") {
      url.pathname = "/";
    }

    return url.toString();
  } catch {
    return null;
  }
}

function htmlToSignalText(html: string) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(stripped).replace(/\s+/g, " ").trim();
}

function extractFooterText(html: string) {
  const chunks: string[] = [];
  const footerPattern = /<footer[^>]*>([\s\S]*?)<\/footer>/gi;
  let match: RegExpExecArray | null;
  while ((match = footerPattern.exec(html)) !== null) {
    chunks.push(match[1] ?? "");
  }
  return htmlToSignalText(chunks.join(" "));
}

function detectSourceSection(context: string): "nav" | "header" | "footer" | "button" | "content" {
  if (/<footer/.test(context)) {
    return "footer";
  }
  if (/<nav/.test(context)) {
    return "nav";
  }
  if (/<header/.test(context)) {
    return "header";
  }
  if (/(button|btn|cta)/.test(context)) {
    return "button";
  }
  return "content";
}

function extractLinks(html: string, pageUrl: string, depth: number): LinkCandidate[] {
  const links: LinkCandidate[] = [];
  const hrefPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const normalized = normalizeCrawlUrl(match[1] ?? "", pageUrl);
    if (!normalized || looksLikeBinaryAsset(normalized)) {
      continue;
    }

    const anchorText = decodeHtml((match[2] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const context = html.slice(Math.max(0, match.index - 240), Math.min(html.length, match.index + 140)).toLowerCase();
    const sourceSection = detectSourceSection(context);
    const navBonus = sourceSection === "nav" || sourceSection === "header" ? 18 : 0;
    const footerBonus = sourceSection === "footer" ? 10 : 0;
    const ctaBonus = sourceSection === "button" ? 10 : 0;
    const bonus =
      /contact|about|faq|hours|visit|reserv|book|menu|event|policy|privacy|terms|club|membership|catering|private/.test(anchorText)
        ? 16
        : 0;

    const bookingBonus = BOOKING_LINK_HINT_REGEX.test(anchorText) ? 12 : 0;

    if (anchorText.length < 2 && sourceSection === "content") {
      continue;
    }

    links.push({
      url: normalized,
      score: linkPriorityScore(normalized) + bonus + navBonus + footerBonus + ctaBonus + bookingBonus,
      depth: depth + 1,
      anchorText,
      sourceSection,
      tier: "secondary", // tier will be overridden by classifyLinkTier in the crawl loop
    });
  }

  return uniqueBy(links, (value) => value.url).sort((a, b) => b.score - a.score);
}

function collectRegexMatches(input: string, pattern: RegExp): string[] {
  const values: string[] = [];
  let match: RegExpExecArray | null;
  const cloned = new RegExp(pattern.source, pattern.flags);
  while ((match = cloned.exec(input)) !== null) {
    const value = (match[0] ?? "").trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function normalizeEmailCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^mailto:/i, "");
  const [addressPart] = withoutPrefix.split("?");
  const decoded = decodeURIComponent(addressPart ?? "").split(",")[0]?.trim() ?? "";
  if (!decoded || !EMAIL_EXACT_PATTERN.test(decoded)) {
    return null;
  }

  return decoded.toLowerCase();
}

function extractJsonLd(html: string): unknown[] {
  const chunks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = (match[1] ?? "").trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      chunks.push(parsed);
    } catch {
      // ignore malformed JSON-LD chunks
    }
  }
  return chunks;
}

function flattenJsonLd(input: unknown): Array<Record<string, unknown>> {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((entry) => flattenJsonLd(entry));
  }
  if (typeof input !== "object") {
    return [];
  }

  const object = input as Record<string, unknown>;
  const graph = Array.isArray(object["@graph"]) ? object["@graph"] : null;
  if (graph) {
    return graph.flatMap((entry) => flattenJsonLd(entry));
  }

  return [object];
}

function collectSignalsFromHtml(args: {
  html: string;
  signalText: string;
  footerText: string;
  pageUrl: string;
  signals: ImportSignals;
}) {
  const { html, signalText, footerText, pageUrl, signals } = args;

  for (const email of collectRegexMatches(signalText, EMAIL_PATTERN)) {
    signals.emails.push({ value: email, sourceUrl: pageUrl });
  }

  for (const phone of collectRegexMatches(signalText, PHONE_PATTERN)) {
    signals.phones.push({ value: phone, sourceUrl: pageUrl });
  }

  const hoursMatch = HOURS_PATTERN.exec(signalText);
  if (hoursMatch?.[0]) {
    signals.hours.push({ value: hoursMatch[0].trim(), sourceUrl: pageUrl });
  }

  const ADDR_FALSE_POSITIVE = /\b(sandwich|burger|chicken|pork|beef|steak|pizza|pasta|salad|soup|dessert|appetizer|beverage|pepper|sausage|glazed|sliders?|wings?|fries|grill|bacon|cheese|shrimp|lobster)\b/i;
  const addressMatch = ADDRESS_PATTERN.exec(signalText);
  if (addressMatch?.[0] && !ADDR_FALSE_POSITIVE.test(addressMatch[0])) {
    signals.addresses.push({ value: addressMatch[0].trim(), sourceUrl: pageUrl });
  }

  const footerAddressMatch = ADDRESS_PATTERN.exec(footerText);
  if (footerAddressMatch?.[0] && !ADDR_FALSE_POSITIVE.test(footerAddressMatch[0])) {
    signals.addresses.push({ value: footerAddressMatch[0].trim(), sourceUrl: pageUrl });
  }

  const footerHoursMatch = HOURS_PATTERN.exec(footerText);
  if (footerHoursMatch?.[0]) {
    signals.hours.push({ value: footerHoursMatch[0].trim(), sourceUrl: pageUrl });
  }

  const hrefPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefPattern.exec(html)) !== null) {
    const href = hrefMatch[1] ?? "";

    if (/^mailto:/i.test(href)) {
      const email = normalizeEmailCandidate(href);
      if (email) {
        signals.emails.push({ value: email, sourceUrl: pageUrl });
      }
      continue;
    }

    if (/^tel:/i.test(href)) {
      const phone = href.replace(/^tel:/i, "").trim();
      if (phone) {
        signals.phones.push({ value: phone, sourceUrl: pageUrl });
      }
      continue;
    }

    const normalized = normalizeCandidateUrl(href, pageUrl);
    if (!normalized) {
      continue;
    }

    const platform = SOCIAL_PATTERNS.find((entry) => entry.pattern.test(normalized))?.platform ?? null;
    if (platform) {
      signals.socialLinks.push({ platform, url: normalized, sourceUrl: pageUrl });
    }
  }

  const iconPattern = /<link\s[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let iconMatch: RegExpExecArray | null;
  while ((iconMatch = iconPattern.exec(html)) !== null) {
    const normalized = normalizeCandidateUrl(iconMatch[1] ?? "", pageUrl);
    if (normalized) {
      signals.faviconCandidates.push({ url: normalized, sourceUrl: pageUrl });
    }
  }

  const logoPattern = /<img\s[^>]*alt=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/gi;
  let logoMatch: RegExpExecArray | null;
  while ((logoMatch = logoPattern.exec(html)) !== null) {
    const normalized = normalizeCandidateUrl(logoMatch[1] ?? "", pageUrl);
    if (normalized) {
      signals.logoCandidates.push({ url: normalized, sourceUrl: pageUrl });
    }
  }

  const bookingLinkPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let bookingMatch: RegExpExecArray | null;
  while ((bookingMatch = bookingLinkPattern.exec(html)) !== null) {
    const href = bookingMatch[1] ?? "";
    const normalized = normalizeCandidateUrl(href, pageUrl);
    if (!normalized) {
      continue;
    }

    const label = decodeHtml((bookingMatch[2] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    const haystack = `${normalized} ${label}`;

    if (!BOOKING_LINK_HINT_REGEX.test(haystack) && !BOOKING_PLATFORM_REGEX.test(normalized)) {
      continue;
    }

    const platform = BOOKING_PLATFORM_REGEX.exec(normalized)?.[1]?.toLowerCase() ?? null;
    signals.bookingLinks.push({
      url: normalized,
      label,
      sourceUrl: pageUrl,
      platform,
    });
  }

  // Context-aware color extraction: 7 passes so the ranker can weight colors by source zone.
  // Pass 0   – CSS custom properties in <style> blocks → highest-confidence brand signal.
  //            Modern builders (Elementor, Squarespace, Webflow, Shopify, Wix, Divi, WP FSE)
  //            store the brand palette as semantically-named CSS variables. Pass 0b also
  //            extracts hex values from CSS rules with brand-zone selectors.
  // Pass 1   – inline SVG blocks (logo fills, icon paths) → strong logo identity signal.
  // Pass 2   – <nav>/<header> blocks → nav-bg (bg-color = brand backdrop, +bonus) and nav (chrome, penalized).
  // Pass 2.5 – large layout containers (<section>, <main>, <article>, layout <div>) →
  //            inline bg-color as "section-bg"; feeds areaWeight accumulation in ranker.
  // Pass 3   – <footer> blocks → brand identity zone (positive bonus in ranker).
  // Pass 4   – <button> elements and CTA-styled anchors → intentional brand accent signal.
  // Pass 5   – remaining HTML after stripping all named zones, so earlier passes are
  //            NOT double-counted with context="style".

  // Pass 0: CSS custom properties + brand-zone CSS rules from <style> blocks.
  {
    const styleContent = collectRegexMatches(html, /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi).join("\n");
    if (styleContent.length > 0) {
      // Sub-pass 0a: CSS custom property declarations (--varname: #hex).
      // Covers all major site builders:
      //   Elementor:    --e-global-color-primary, --e-global-color-accent, --e-global-color-secondary
      //   WP Block/FSE: --wp--preset--color--primary, --wp--preset--color--vivid-red
      //   Divi:         --et_global_primary_color, --et_global_secondary_color
      //   Squarespace:  --accent, --color-primaryButton, --sqs-site-color-*
      //   Webflow:      --brand-primary, --color-accent
      //   Shopify:      --color-brand, --color-accent, --color-button
      //   Wix:          --color_1 through --color_35 (numbered palette)
      //   Framer/plain: --primary, --accent, --brand
      //
      // CRITICAL: builders like Elementor define default palette variables
      // (--e-global-color-primary: #6EC1E4) that are NEVER applied to any element
      // on a customized site. To avoid these swamping real brand colors, we first
      // build a usage frequency map — counting how many times each variable appears
      // as var(--name) across the style blocks and inline HTML. Variables with zero
      // usages are palette ghosts and are skipped. Variables used many times are
      // pushed that many times into the candidate pool so frequency-based scoring
      // correctly reflects how dominant the color is on the page.
      const varUsageCounts = new Map<string, number>();
      {
        const VAR_REF_RE = /var\(\s*--([\w-]+)/g;
        let usageM: RegExpExecArray | null;
        // Count in style block content
        while ((usageM = VAR_REF_RE.exec(styleContent)) !== null) {
          const name = (usageM[1] ?? "").toLowerCase();
          varUsageCounts.set(name, (varUsageCounts.get(name) ?? 0) + 1);
        }
        // Count in inline style attributes and the rest of the HTML
        const htmlVarRe = new RegExp(VAR_REF_RE.source, VAR_REF_RE.flags);
        while ((usageM = htmlVarRe.exec(html)) !== null) {
          const name = (usageM[1] ?? "").toLowerCase();
          varUsageCounts.set(name, (varUsageCounts.get(name) ?? 0) + 1);
        }
      }

      const CSS_VAR_RE = /--([a-zA-Z0-9_-]+)\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g;
      let varMatch: RegExpExecArray | null;
      while ((varMatch = CSS_VAR_RE.exec(styleContent)) !== null) {
        const varName = (varMatch[1] ?? "").toLowerCase();
        const norm = normalizeHexColor(varMatch[2] ?? "");
        if (!norm) continue;

        const usageCount = varUsageCounts.get(varName) ?? 0;
        // Skip completely unused variables — these are builder palette defaults
        // that were never applied to any element (e.g. Elementor's factory blue).
        if (usageCount === 0) continue;

        let context: string;
        if (/primary|(?:^|[-_])brand[-_]?(?:color|primary)?$|main-?color|theme-?color/.test(varName)) {
          context = "cssvar-primary";
        } else if (/(?:^|[-_])accent(?:[-_]|$)|(?:^|[-_])cta(?:[-_]|$)|button-?(?:bg|background)|(?:^|[-_])highlight(?:[-_]|$)|featured-?color/.test(varName)) {
          context = "cssvar-accent";
        } else if (/secondary/.test(varName)) {
          context = "cssvar-secondary";
        } else {
          // Any used hex-valued CSS variable — even opaque builder names like
          // --e-global-color-abc123 — is a legitimate brand signal.
          context = "cssvar";
        }

        // Push once per usage (capped at 10): converts var() reference frequency
        // into ranker candidate frequency so heavily-applied colors score higher.
        const reps = Math.min(usageCount, 10);
        for (let i = 0; i < reps; i++) {
          signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context });
        }
      }

      // Sub-pass 0b: CSS rule blocks with brand-zone selectors.
      // Captures builders that emit final hex values directly in selector rules rather
      // than CSS variables (older WP themes, Genesis, Squarespace themes, Beaver Builder).
      // We extract both background-color AND color (text) from these zones:
      //   - button background-color → brand accent (the CTA color)
      //   - nav/header color (text) → brand primary (logo text, nav links like WC gold)
      //   - footer background-color → brand identity confirmation
      const CSS_RULE_RE = /([^{}@][^{}]*)\{([^{}]+)\}/g;
      let ruleMatch: RegExpExecArray | null;
      while ((ruleMatch = CSS_RULE_RE.exec(styleContent)) !== null) {
        const selector = (ruleMatch[1] ?? "").toLowerCase();
        const declarations = ruleMatch[2] ?? "";
        let ruleContext: string | null = null;
        const isButton = /\bbtn\b|\.button\b|\bbutton\s*[{,>~+ ]|\bbutton$|\[type=["']?(?:submit|button)|\belementor-button\b|\bdivi-button\b|\bwp-block-button\b/.test(selector);
        const isFooter = /\bfooter\b/.test(selector);
        const isNavHeader = /\bnav\b|\bheader\b|\bsite-header\b|\bsite-nav\b/.test(selector);

        if (!isButton && !isFooter && !isNavHeader) continue;
        ruleContext = isButton ? "button" : isFooter ? "footer" : "nav";

        // Background color: meaningful for buttons and footers
        const BG_RE = /background(?:-color)?\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/gi;
        let bgMatch: RegExpExecArray | null;
        while ((bgMatch = BG_RE.exec(declarations)) !== null) {
          const norm = normalizeHexColor(bgMatch[1] ?? "");
          if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: ruleContext });
        }

        // Text color in nav/header: gold/brand-colored nav links and logo text are a
        // strong brand signal (e.g. Windmill Creek's gold logo text and navigation links).
        // Tag as "logo" so the scorer gives them a positive bonus instead of the nav penalty.
        if (isNavHeader) {
          const COLOR_RE = /(?:^|;)\s*color\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/gi;
          let textMatch: RegExpExecArray | null;
          while ((textMatch = COLOR_RE.exec(declarations)) !== null) {
            const norm = normalizeHexColor(textMatch[1] ?? "");
            // "logo" context: intentional brand color in nav/header text (not background chrome)
            if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "logo" });
          }
        }
      }
    }
  }

  {
    const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

    // Pass 1: SVG fills/strokes — logo identity colors.
    for (const svgBlock of collectRegexMatches(html, /<svg(?:\s[^>]*)?>(?:[\s\S]*?)<\/svg>/gi)) {
      for (const val of collectRegexMatches(svgBlock, HEX_RE)) {
        const norm = normalizeHexColor(val);
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "svg" });
      }
    }

    // Pass 1.5: Explicit logo/brand-mark containers.
    // Elements whose class or id attribute contains "logo", "brand", "navbar-brand",
    // "site-logo", "custom-logo" etc. are almost always the brand mark — extract their
    // inline fill/color values and any nested SVG fills as "logo" context (highest non-cssvar bonus).
    // Covers WordPress/Elementor/Wix/Squarespace/Webflow logo widget patterns.
    {
      const LOGO_ELEM_RE = /<(?:a|div|span|img|figure|h1|h2|p)\s[^>]*(?:class|id)=["'][^"']*\b(?:logo|brand|site-logo|navbar-brand|custom-logo|site-branding|header-logo|brand-logo)\b[^"']*["'][^>]*>(?:[\s\S]*?)<\/(?:a|div|span|figure|h1|h2|p)>/gi;
      const ELEMENTOR_LOGO_RE = /<div\s[^>]*class=["'][^"']*\belementor-widget-site-logo\b[^"']*["'][^>]*>(?:[\s\S]*?)<\/div>/gi;
      const WP_LOGO_RE = /<(?:a|div)\s[^>]*class=["'][^"']*\b(?:wp-block-site-logo|site-logo|custom-logo-link)\b[^"']*["'][^>]*>(?:[\s\S]*?)<\/(?:a|div)>/gi;
      for (const logoRe of [LOGO_ELEM_RE, ELEMENTOR_LOGO_RE, WP_LOGO_RE]) {
        for (const block of collectRegexMatches(html, logoRe)) {
          // SVG fills inside logo containers
          for (const svgBlock of collectRegexMatches(block, /<svg(?:\s[^>]*)?>(?:[\s\S]*?)<\/svg>/gi)) {
            for (const val of collectRegexMatches(svgBlock, HEX_RE)) {
              const norm = normalizeHexColor(val);
              if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "logo" });
            }
          }
          // Inline fill/color/background in logo container
          const LOGO_PROP_RE = /(?:fill|color|background(?:-color)?)\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b)/gi;
          for (const val of collectRegexMatches(block, LOGO_PROP_RE)) {
            const norm = normalizeHexColor(val);
            if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "logo" });
          }
        }
      }
    }

    // Pass 2: nav/header — split by property type:
    // • Sub-pass 2a: background-color → "nav-bg" context: a solid brand-colored navigation
    //   backdrop is a deliberate brand identity element (e.g. a red nav bar on a restaurant
    //   site). These get a positive zone bonus in the ranker (+35) instead of the nav penalty.
    // • Sub-pass 2b: all other hex values → "nav" context (layout chrome, penalized).
    // Strip SVG blocks first to avoid double-counting logo SVG fills from Pass 1.
    for (const rawBlock of collectRegexMatches(html, /<(?:nav|header)(?:\s[^>]*)?>(?:[\s\S]*?)<\/(?:nav|header)>/gi)) {
      const block = rawBlock.replace(/<svg(?:\s[^>]*)?>(?:[\s\S]*?)<\/svg>/gi, "");
      // Sub-pass 2a: background-color in nav/header → "nav-bg" (brand backdrop signal).
      const NAV_BG_RE = /background(?:-color)?\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b)/gi;
      let navBgM: RegExpExecArray | null;
      while ((navBgM = NAV_BG_RE.exec(block)) !== null) {
        const norm = normalizeHexColor(navBgM[1] ?? "");
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "nav-bg" });
      }
      // Sub-pass 2b: remaining hex values in nav/header → "nav" (layout chrome, penalized).
      const blockWithoutNavBg = block.replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,6}\b/gi, "");
      for (const val of collectRegexMatches(blockWithoutNavBg, HEX_RE)) {
        const norm = normalizeHexColor(val);
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "nav" });
      }
    }

    // Pass 3: footer — brand identity zone. Footers reliably reproduce the primary brand
    // color as a background or border, making them a strong secondary confirmation signal.
    for (const block of collectRegexMatches(html, /<footer(?:\s[^>]*)?>(?:[\s\S]*?)<\/footer>/gi)) {
      for (const val of collectRegexMatches(block, HEX_RE)) {
        const norm = normalizeHexColor(val);
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "footer" });
      }
    }

    // Pass 4: buttons and CTA-styled anchor/div elements.
    // These receive the brand accent color intentionally — a designer chose this.
    // Matches: <button>, and <a>/<div>/<span> whose class attribute contains
    // btn, button, or cta (common CSS conventions).
    const CTA_RE = /<(?:button(?:\s[^>]*)?|(?:a|div|span)\s[^>]*class=["'][^"']*\b(?:btn|button|cta)\b[^"']*["'][^>]*)>[\s\S]*?<\/(?:button|a|div|span)>/gi;
    for (const block of collectRegexMatches(html, CTA_RE)) {
      for (const val of collectRegexMatches(block, HEX_RE)) {
        const norm = normalizeHexColor(val);
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "button" });
      }
    }

    // Pass 5: remainder of body HTML — strip all already-extracted zones first.
    // Also strip img tags (hex near src/srcset attributes is never a CSS brand signal)
    // and opening tags of hero/banner/promo containers whose background colors reflect
    // seasonal or staging choices rather than the permanent brand identity.
    const bodyHtml = html
      .replace(/<svg(?:\s[^>]*)?>(?:[\s\S]*?)<\/svg>/gi, "")
      .replace(/<(?:nav|header)(?:\s[^>]*)?>(?:[\s\S]*?)<\/(?:nav|header)>/gi, "")
      .replace(/<footer(?:\s[^>]*)?>(?:[\s\S]*?)<\/footer>/gi, "")
      .replace(/<(?:button(?:\s[^>]*)?|(?:a|div|span)\s[^>]*class=["'][^"']*\b(?:btn|button|cta)\b[^"']*["'][^>]*)>[\s\S]*?<\/(?:button|a|div|span)>/gi, "")
      // Strip img tags — hex values in src/srcset/alt attributes are never brand colors.
      .replace(/<img\s[^>]*\/?>/gi, "")
      // Strip hero/banner/promo container opening tags so their large background-color
      // declarations (often injected by page builders as section-level overrides) do not
      // swamp the candidate pool with non-brand colors. We only strip the opening tag so
      // inline text content (which may contain real brand hex values) is still scanned.
      .replace(/<(?:div|section)\s[^>]*class=["'][^"']*\b(?:hero|banner|slider|carousel|promo|splash|masthead|jumbotron|event-banner|seasonal|cover-image|bg-image|hero-image)\b[^"']*["'][^>]*>/gi, "");
    // Pass 5a: explicit CSS background-color / background: #hex declarations → context "bg".
    // Solid bg-color properties reflect deliberate designer choices. Dark/saturated values
    // boost brand primary scoring; light values feed surface-color detection.
    {
      const BG_PROP_RE = /background(?:-color)?\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b)/gi;
      let bgColorMatch: RegExpExecArray | null;
      while ((bgColorMatch = BG_PROP_RE.exec(bodyHtml)) !== null) {
        const norm = normalizeHexColor(bgColorMatch[1] ?? "");
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "bg" });
      }
    }
    // Pass 5b: all remaining hex values — strip bg-color declarations first to avoid
    // double-counting with the "bg" context captured above.
    const bodyWithoutBg = bodyHtml.replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,6}\b/gi, "");
    for (const val of collectRegexMatches(bodyWithoutBg, HEX_RE)) {
      const norm = normalizeHexColor(val);
      if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "style" });
    }
  }

  const fontPattern = /font-family\s*:\s*([^;}{]+)/gi;
  let fontMatch: RegExpExecArray | null;
  while ((fontMatch = fontPattern.exec(html)) !== null) {
    const value = (fontMatch[1] ?? "").trim().replace(/["']/g, "");
    if (value) {
      signals.fontCandidates.push({ value, sourceUrl: pageUrl });
    }
  }

  const jsonLdEntries = extractJsonLd(html).flatMap((entry) => flattenJsonLd(entry));
  for (const entry of jsonLdEntries) {
    const sameAs = entry.sameAs;
    if (Array.isArray(sameAs)) {
      for (const value of sameAs) {
        if (typeof value !== "string") {
          continue;
        }
        const normalized = normalizeCandidateUrl(value, pageUrl);
        if (!normalized) {
          continue;
        }
        const platform = SOCIAL_PATTERNS.find((item) => item.pattern.test(normalized))?.platform ?? "other";
        signals.socialLinks.push({ platform, url: normalized, sourceUrl: pageUrl });
      }
    }

    if (typeof entry.telephone === "string") {
      signals.phones.push({ value: entry.telephone, sourceUrl: pageUrl });
    }

    if (typeof entry.email === "string") {
      const email = normalizeEmailCandidate(entry.email);
      if (email) {
        signals.emails.push({ value: email, sourceUrl: pageUrl });
      }
    }

    const openingHours = entry.openingHours;
    if (typeof openingHours === "string") {
      signals.hours.push({ value: openingHours, sourceUrl: pageUrl });
    } else if (Array.isArray(openingHours)) {
      const merged = openingHours.filter((value): value is string => typeof value === "string").join("; ");
      if (merged) {
        signals.hours.push({ value: merged, sourceUrl: pageUrl });
      }
    }

    if (Array.isArray(entry.openingHoursSpecification)) {
      const chunks: string[] = [];
      for (const item of entry.openingHoursSpecification) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const spec = item as Record<string, unknown>;
        const day = Array.isArray(spec.dayOfWeek)
          ? spec.dayOfWeek.filter((value): value is string => typeof value === "string").join(", ")
          : typeof spec.dayOfWeek === "string"
            ? spec.dayOfWeek
            : "";
        const opens = typeof spec.opens === "string" ? spec.opens : "";
        const closes = typeof spec.closes === "string" ? spec.closes : "";
        const merged = `${day} ${opens && closes ? `${opens}-${closes}` : ""}`.trim();
        if (merged) {
          chunks.push(merged);
        }
      }
      if (chunks.length > 0) {
        signals.hours.push({ value: chunks.join("; "), sourceUrl: pageUrl });
      }
    }

    const address = entry.address;
    if (typeof address === "string") {
      signals.addresses.push({ value: address, sourceUrl: pageUrl });
    } else if (address && typeof address === "object") {
      const obj = address as Record<string, unknown>;
      const street = typeof obj.streetAddress === "string" ? obj.streetAddress : "";
      const city = typeof obj.addressLocality === "string" ? obj.addressLocality : "";
      const region = typeof obj.addressRegion === "string" ? obj.addressRegion : "";
      const postal = typeof obj.postalCode === "string" ? obj.postalCode : "";
      const country = typeof obj.addressCountry === "string" ? obj.addressCountry : "";
      const merged = [street, city, [region, postal].filter(Boolean).join(" "), country].filter(Boolean).join(", ");
      if (merged) {
        signals.addresses.push({ value: merged, sourceUrl: pageUrl });
      }
    }
  }
}

function extractHeadingText(html: string): string[] {
  const headings: string[] = [];
  const headingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html)) !== null) {
    const value = decodeHtml((match[1] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (value) {
      headings.push(value);
    }
    if (headings.length >= 18) {
      break;
    }
  }
  return headings;
}

function extractMetaDescription(html: string): string {
  const match = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)
    ?? /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i.exec(html);
  return decodeHtml((match?.[1] ?? "").trim());
}

function dedupeSignals(signals: ImportSignals): ImportSignals {
  return {
    emails: uniqueBy(signals.emails, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    phones: uniqueBy(signals.phones, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    addresses: uniqueBy(signals.addresses, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    hours: uniqueBy(signals.hours, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    bookingLinks: uniqueBy(signals.bookingLinks, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    socialLinks: uniqueBy(signals.socialLinks, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    logoCandidates: uniqueBy(signals.logoCandidates, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    faviconCandidates: uniqueBy(signals.faviconCandidates, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    colorCandidates: uniqueBy(signals.colorCandidates, (entry) => `${entry.value.toUpperCase()}::${entry.sourceUrl}::${entry.context ?? "style"}`),
    fontCandidates: uniqueBy(signals.fontCandidates, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
  };
}

export async function crawlWebsite(
  seedUrl: string,
  options?: { onPageCrawled?: (pages: CrawledPage[]) => Promise<void> | void },
): Promise<CrawlResult> {
  const normalizedSeed = normalizeWebsiteUrl(seedUrl);

  // ── Tracking state ───────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];
  const signals: ImportSignals = {
    emails: [], phones: [], addresses: [], hours: [], bookingLinks: [],
    socialLinks: [], logoCandidates: [], faviconCandidates: [], colorCandidates: [], fontCandidates: [],
  };
  const coverage = initCoverage();
  const anchorTextsByUrl = new Map<string, Set<string>>();
  const excludedLinks: Array<{ url: string; anchorText: string; reason: string }> = [];
  const siblingEntities: SiblingEntity[] = [];
  const detectedSiblingRoots = new Set<string>(); // first path segment of detected sibling brands
  let stoppingReason = "crawl budget exhausted";
  let totalChars = 0;
  // Budget counters
  let corePagesConsumed = 0;
  let secondaryPagesConsumed = 0;

  // Track per-tier budget consumption for accepted pages (not in the queue but in pages[])
  const pageTiers = new Map<string, LinkTier>(); // url → tier

  // ── Queue management ─────────────────────────────────────────────────────────
  // Queue carries tier info so budget enforcement is deterministic
  const discovered = new Map<string, { score: number; count: number; depth: number; tier: LinkTier }>();

  const enqueue = (candidate: LinkCandidate) => {
    if (candidate.depth > WEBSITE_IMPORT_LIMITS.maxDepth) return;
    if (candidate.tier === "low-value") {
      // Do not enqueue low-value links
      excludedLinks.push({ url: candidate.url, anchorText: candidate.anchorText, reason: `tier=low-value (not enqueued)` });
      return;
    }
    const existing = discovered.get(candidate.url);
    if (!existing) {
      discovered.set(candidate.url, { score: candidate.score, count: 1, depth: candidate.depth, tier: candidate.tier });
      queue.push(candidate);
    } else {
      existing.count += 1;
      existing.depth = Math.min(existing.depth, candidate.depth);
      existing.score = Math.max(existing.score, candidate.score + Math.min(existing.count * 3, 24));
      // Upgrade tier if we see the same link classified as core
      if (candidate.tier === "core" && existing.tier !== "core") {
        existing.tier = "core";
      }
      for (const queued of queue) {
        if (queued.url === candidate.url) {
          queued.score = Math.max(queued.score, existing.score);
          queued.depth = Math.min(queued.depth, existing.depth);
          queued.tier = existing.tier;
          break;
        }
      }
    }

    if (candidate.anchorText) {
      const existingAnchors = anchorTextsByUrl.get(candidate.url) ?? new Set<string>();
      existingAnchors.add(candidate.anchorText.slice(0, 120));
      anchorTextsByUrl.set(candidate.url, existingAnchors);
    }
  };

  // Seed page is always core (it's the homepage)
  const queue: LinkCandidate[] = [{
    url: normalizedSeed,
    score: 140,
    depth: 0,
    anchorText: "seed",
    sourceSection: "content",
    tier: "core",
  }];
  discovered.set(normalizedSeed, { score: 140, count: 1, depth: 0, tier: "core" });

  // Pre-enqueue HIGH_SIGNAL_PATHS at depth=1 as core candidates
  // These are deterministic path guesses that remain in queue but only fetch
  // if not already found via nav discovery. Sorted by linkPriorityScore to be stable.
  for (const path of HIGH_SIGNAL_PATHS) {
    const candidate = normalizeCrawlUrl(path, normalizedSeed);
    if (!candidate || seen.has(candidate)) continue;
    const { tier } = classifyLinkTier(candidate, path.replace("/", "").replace(/-/g, " "));
    enqueue({
      url: candidate,
      score: 86 + linkPriorityScore(candidate),
      depth: 1,
      anchorText: path,
      sourceSection: "nav",
      tier: tier === "low-value" ? "secondary" : tier, // high-signal paths are at least secondary
    });
  }

  // Sort queue deterministically: core first, then by score desc, then depth asc
  const sortQueue = () => {
    queue.sort((a, b) => {
      const aData = discovered.get(a.url);
      const bData = discovered.get(b.url);
      const aScore = (aData?.score ?? a.score) - a.depth * 4;
      const bScore = (bData?.score ?? b.score) - b.depth * 4;
      // Core pages always before secondary
      const aTier = aData?.tier ?? a.tier;
      const bTier = bData?.tier ?? b.tier;
      if (aTier === "core" && bTier !== "core") return -1;
      if (aTier !== "core" && bTier === "core") return 1;
      return bScore - aScore;
    });
  };

  sortQueue();

  // ── Main crawl loop ──────────────────────────────────────────────────────────
  while (queue.length > 0 && pages.length < WEBSITE_IMPORT_LIMITS.maxPages && totalChars < WEBSITE_IMPORT_LIMITS.maxChars) {
    // Sort before each pick to ensure deterministic priority ordering
    sortQueue();

    const next = queue.shift();
    const nextUrl = next?.url;
    if (!nextUrl || seen.has(nextUrl)) continue;

    const currentDepth = next?.depth ?? 0;
    if (currentDepth > WEBSITE_IMPORT_LIMITS.maxDepth) continue;

    const currentTier: LinkTier = (discovered.get(nextUrl)?.tier ?? next?.tier ?? "secondary");

    // Budget enforcement: skip if tier budget exceeded
    if (currentTier === "core" && corePagesConsumed >= CORE_PAGE_BUDGET) {
      console.log(`[crawl] SKIP budget-core-exhausted url=${nextUrl}`);
      excludedLinks.push({ url: nextUrl, anchorText: next?.anchorText ?? "", reason: "core page budget exhausted" });
      seen.add(nextUrl);
      continue;
    }
    if (currentTier === "secondary" && secondaryPagesConsumed >= SECONDARY_PAGE_BUDGET) {
      console.log(`[crawl] SKIP budget-secondary-exhausted url=${nextUrl}`);
      excludedLinks.push({ url: nextUrl, anchorText: next?.anchorText ?? "", reason: "secondary page budget exhausted" });
      seen.add(nextUrl);
      continue;
    }

    seen.add(nextUrl);

    console.log(`[crawl] FETCH tier=${currentTier} depth=${currentDepth} score=${next?.score ?? 0} url=${nextUrl}`);

    let response: Response;
    try {
      response = await withTimeout(nextUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "TandemWebsiteImporter/1.0 (+https://tandem.dev)",
          accept: "text/html,application/xhtml+xml",
        },
      }, WEBSITE_IMPORT_LIMITS.requestTimeoutMs);
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) continue;

    let html = "";
    try {
      html = await response.text();
    } catch {
      continue;
    }

    const title = extractTitle(html) || new URL(nextUrl).hostname;
    const text = htmlToText(html);
    const signalText = htmlToSignalText(html);
    const footerText = extractFooterText(html);
    if (!text && !signalText) continue;

    const remaining = WEBSITE_IMPORT_LIMITS.maxChars - totalChars;
    const excerptLimit = Math.min(WEBSITE_IMPORT_LIMITS.perPageChars, Math.max(0, remaining));
    const textExcerpt = excerptText(text || signalText, excerptLimit);
    if (!textExcerpt) continue;

    const lowerUrl = nextUrl.toLowerCase();
    const haystack = `${lowerUrl} ${title}`;
    const needsStructuredText = /menu|food|dining|drink|wine|cocktail|brunch|dinner|lunch|faq|frequently|policy|policies|about|private.event|club|membership|contact|hours|visit|reservation|dog|pet|parking|dress|cancel/i.test(haystack);
    const structuredText = needsStructuredText ? excerptText(htmlToStructuredText(html), excerptLimit) : undefined;

    const metaDescription = extractMetaDescription(html);
    const headingHtml = html
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    const headingText = extractHeadingText(headingHtml);
    const sourceAnchorTexts = Array.from(anchorTextsByUrl.get(nextUrl) ?? []).slice(0, 12);

    const pageType = classifyPageType({ url: nextUrl, title, textExcerpt, metaDescription, headingText, sourceAnchorTexts });

    // ── Sibling business detection ─────────────────────────────────────────────
    // The existing looksLikeOffBrandPage uses slug-based heuristics.
    // We extend it: when we detect a sibling, log it with a reason and record its path root.
    if (looksLikeOffBrandPage(nextUrl, currentDepth, title)) {
      const firstSegment = new URL(nextUrl).pathname.split("/").filter(Boolean)[0] ?? "";
      console.log(`[crawl] SIBLING-SKIP depth=${currentDepth} segment="${firstSegment}" title="${title.slice(0, 60)}" url=${nextUrl}`);

      if (!detectedSiblingRoots.has(firstSegment)) {
        detectedSiblingRoots.add(firstSegment);
        const siblingName = title.split(/[|\-–]/)[0]?.trim() ?? firstSegment;
        const reason = `URL path starts with "${firstSegment}" — no restaurant-relevant words and title has no food vocabulary`;
        siblingEntities.push({ name: siblingName, probableUrl: nextUrl, reason });
        console.log(`[crawl] SIBLING-ENTITY detected: name="${siblingName}" reason="${reason}"`);
      }

      excludedLinks.push({ url: nextUrl, anchorText: next?.anchorText ?? "", reason: `sibling entity (/${firstSegment})` });

      // Still follow links from this page that point to known CORE paths
      const offBrandNavLinks = extractNavigationLinks(html, nextUrl);
      for (const navLink of offBrandNavLinks) {
        if (!isSameDomain(normalizedSeed, navLink.url) || seen.has(navLink.url)) continue;
        // Skip links that go deeper into this sibling root
        const linkFirstSeg = new URL(navLink.url).pathname.split("/").filter(Boolean)[0] ?? "";
        if (detectedSiblingRoots.has(linkFirstSeg)) continue;
        const { tier } = classifyLinkTier(navLink.url, navLink.anchorText);
        if (tier === "core") {
          enqueue({ url: navLink.url, score: 90, depth: currentDepth + 1, anchorText: navLink.anchorText, sourceSection: "nav", tier: "core" });
        }
      }
      continue;
    }

    // ── Accept page ────────────────────────────────────────────────────────────
    if (currentTier === "core") corePagesConsumed++;
    else if (currentTier === "secondary") secondaryPagesConsumed++;

    pageTiers.set(nextUrl, currentTier);

    console.log(`[crawl] ACCEPT tier=${currentTier} depth=${currentDepth} score=${next?.score ?? 0} type=${pageType} url=${nextUrl}`);

    const acceptedPage: CrawledPage = {
      url: nextUrl,
      title,
      textExcerpt,
      structuredText,
      pageType,
      metaDescription,
      headingText,
      sourceAnchorTexts,
    };
    pages.push(acceptedPage);
    totalChars += textExcerpt.length;

    // Update knowledge coverage from this page
    updateCoverageFromPage(coverage, acceptedPage);

    if (options?.onPageCrawled) {
      await options.onPageCrawled([...pages]);
    }

    // section-bg color extraction
    {
      const sectionScanHtml = html
        .replace(/<(?:nav|header)(?:\s[^>]*)?>(?:[\s\S]*?)<\/(?:nav|header)>/gi, "")
        .replace(/<footer(?:\s[^>]*)?>(?:[\s\S]*?)<\/footer>/gi, "")
        .replace(/<(?:div|section)\s[^>]*class=["'][^"']*\b(?:hero|banner|slider|carousel|promo|splash|masthead|jumbotron|event-banner|seasonal|cover-image|bg-image|hero-image)\b[^"']*["'][^>]*>/gi, "");
      const LAYOUT_TAG_RE = /<(?:section|main|article)(?:\s[^>]*)?>|<(?:div|aside)\s[^>]*class=["'][^"']*\b(?:container|wrapper|full-width|site-content|page-content|content-area|site-inner|main-content|inner-wrap)\b[^"']*["'][^>]*>/gi;
      const INLINE_BG_RE = /style=["'][^"']*background(?:-color)?\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/i;
      for (const openTag of collectRegexMatches(sectionScanHtml, LAYOUT_TAG_RE)) {
        const bgMatch = INLINE_BG_RE.exec(openTag);
        if (!bgMatch) continue;
        const norm = normalizeHexColor(bgMatch[1] ?? "");
        if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: nextUrl, context: "section-bg" });
      }
    }

    collectSignalsFromHtml({ html, signalText, footerText, pageUrl: nextUrl, signals });

    // ── Navigation-first link discovery ────────────────────────────────────────
    // On the SEED page: use navigation-first discovery and log all findings.
    // On subsequent pages: still prefer nav links but also harvest content links.
    const isHomePage = currentDepth === 0;
    if (isHomePage) {
      const navLinks = extractNavigationLinks(html, nextUrl);
      console.log(`[crawl/nav] Discovered ${navLinks.length} navigation links from seed`);
      for (const navLink of navLinks) {
        if (!isSameDomain(normalizedSeed, navLink.url)) continue;
        const { tier, reason } = classifyLinkTier(navLink.url, navLink.anchorText);
        console.log(`[crawl/nav]   ${tier.padEnd(10)} src=${navLink.source.padEnd(12)} anchor="${navLink.anchorText.slice(0, 40).padEnd(40)}" → ${new URL(navLink.url).pathname} (${reason})`);
        if (tier === "low-value") {
          excludedLinks.push({ url: navLink.url, anchorText: navLink.anchorText, reason });
          continue;
        }
        enqueue({
          url: navLink.url,
          score: tier === "core" ? 110 + linkPriorityScore(navLink.url) : 60 + linkPriorityScore(navLink.url),
          depth: 1,
          anchorText: navLink.anchorText,
          sourceSection: navLink.source === "header-nav" ? "header" : navLink.source === "footer-nav" ? "footer" : "nav",
          tier,
        });
      }
    }

    // Also extract regular links (from body content) with classification + tier scoring
    const allLinks = extractLinks(html, nextUrl, currentDepth);
    for (const link of allLinks) {
      if (!isSameDomain(normalizedSeed, link.url) || seen.has(link.url)) continue;
      // Skip links that go into known sibling brand roots
      const linkFirstSeg = new URL(link.url).pathname.split("/").filter(Boolean)[0] ?? "";
      if (detectedSiblingRoots.has(linkFirstSeg)) continue;

      const { tier, reason } = classifyLinkTier(link.url, link.anchorText);
      if (tier === "low-value") {
        // Only log once per URL to avoid log spam
        if (!discovered.has(link.url) && !excludedLinks.some((e) => e.url === link.url)) {
          excludedLinks.push({ url: link.url, anchorText: link.anchorText, reason });
        }
        continue;
      }
      enqueue({ ...link, tier });
    }

    // ── Early stopping check ────────────────────────────────────────────────────
    const stopReason = checkEarlyStopping(coverage);
    if (stopReason) {
      stoppingReason = stopReason;
      console.log(`[crawl] EARLY-STOP: ${stopReason}`);
      break;
    }
  }

  // ── Post-crawl reporting ─────────────────────────────────────────────────────
  console.log(`[crawl] Finished: ${pages.length} pages accepted (core=${corePagesConsumed} secondary=${secondaryPagesConsumed}), ${seen.size} URLs visited, ${queue.length} remaining`);
  console.log(`[crawl] Stopping reason: ${stoppingReason}`);

  const byType = pages.reduce<Record<string, number>>((acc, p) => {
    const t = p.pageType ?? "general";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[crawl] Page types: ${Object.entries(byType).map(([t, n]) => `${t}=${n}`).join(", ")}`);

  console.log(`[crawl] Knowledge coverage:`);
  for (const [area, cov] of coverage) {
    if (cov.found) {
      console.log(`[crawl]   ✓ ${area.padEnd(20)} confidence=${cov.confidence} sources=[${cov.sourcePages.map((u) => new URL(u).pathname).join(", ")}]`);
    } else {
      console.log(`[crawl]   ✗ ${area} — not found`);
    }
  }

  for (const page of pages) {
    const tier = pageTiers.get(page.url) ?? "core";
    const path = new URL(page.url).pathname;
    console.log(`[crawl]   ACCEPTED tier=${tier} ${page.pageType ?? "general"} | ${path} — "${page.title}"`);
  }

  if (siblingEntities.length > 0) {
    console.log(`[crawl] Sibling entities detected (${siblingEntities.length}):`);
    for (const s of siblingEntities) {
      console.log(`[crawl]   - ${s.name}: ${s.reason}`);
    }
  }

  if (excludedLinks.length > 0) {
    console.log(`[crawl] Excluded links (${excludedLinks.length} total — first 20 shown):`);
    for (const e of excludedLinks.slice(0, 20)) {
      console.log(`[crawl]   EXCLUDED "${e.anchorText.slice(0, 40)}" → ${e.url} (${e.reason})`);
    }
  }

  const crawlReport: import("./types").CrawlReport = {
    knowledgeCoverage: [...coverage.values()],
    includedPages: pages.map((p) => ({
      url: p.url,
      title: p.title,
      pageType: p.pageType ?? "general",
      tier: pageTiers.get(p.url) ?? "core",
    })),
    excludedLinks: excludedLinks.slice(0, 50), // cap for storage
    siblingEntities,
    stoppingReason,
  };

  return {
    pages,
    signals: dedupeSignals(signals),
    crawlReport,
  };
}
