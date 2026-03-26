import { llmGenerate, validateLLMServerConfig } from "@tandem/shared/server";
import type {
  CrawledPage,
  ImportEvent,
  ImportFaq,
  ImportMembershipInfo,
  ImportMenuItem,
  ImportMenuSection,
  ImportPolicy,
  ImportReservationInfo,
  ImportSignals,
  MenuSemanticCategory,
  ReservationStatus,
  WebsiteImportDraft,
  WebsiteImportResult,
  WebsitePageType,
} from "./types";
import { isLikelyFaqPage, normalizeFaqCandidate } from "./faq-heuristics";
import { createId, normalizeHexColor, pickDistinctAccentColor, pickReadableTextColor, pickSurfaceColor, rankBrandColorCandidates, stripBoilerplateText } from "./utils";

type RawFaq = {
  question?: unknown;
  answer?: unknown;
  source_url?: unknown;
};

type RawPolicy = {
  title?: unknown;
  summary?: unknown;
  source_url?: unknown;
};

type RawDraft = {
  business_name?: unknown;
  short_description?: unknown;
  phone?: unknown;
  phone_source_url?: unknown;
  email?: unknown;
  email_source_url?: unknown;
  address?: unknown;
  address_source_url?: unknown;
  hours?: unknown;
  hours_source_url?: unknown;
  social_links?: unknown;
  faqs?: unknown;
  policies?: unknown;
  event_highlights?: unknown;
  reservation_guidance?: unknown;
  membership_notes?: unknown;
  menu_summary?: unknown;
  brand?: unknown;
};

function bestPageSnippet(pages: CrawledPage[], matcher: RegExp, fallbackLength = 220): string | null {
  const page = pages.find((entry) => matcher.test(`${entry.url} ${entry.title} ${entry.textExcerpt}`.toLowerCase()));
  if (!page) {
    return null;
  }
  const compact = page.textExcerpt.replace(/\s+/g, " ").trim();
  return compact.slice(0, fallbackLength) || null;
}

const POLICY_HINT_REGEX = /(policy|policies|terms|privacy|return|refund|shipping|reservation|booking|cancellation|cancel)/i;
const BOOKING_PLATFORM_REGEX = /(opentable|resy|tock|toasttab|sevenrooms|exploretock|bookeo)/i;
const POLICY_NOISE_REGEX = /(skip\s+to\s+content|main\s+menu|see\s+more|share\b|comments?|likes?|copy\s+link|facebook|instagram|x\.com|twitter|pinterest|utm_|cookie\s+policy|newsletter)/i;
const MONTH_REGEX = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;

const PAGE_TYPE_HINTS: Record<WebsitePageType, RegExp[]> = {
  home: [/^\/$/, /\bhome\b/, /welcome/i],
  menu: [/\bmenu\b/, /food|dining|drink|wine\s+list|brunch|lunch|dinner/i],
  events: [/\bevent\b/, /calendar|upcoming|happenings|live\s+music|what'?s\s+on/i],
  reservations: [/reserv|book\b/, /opentable|resy|tock|sevenrooms|toast/i],
  memberships: [/membership|wine\s*club|loyalty|join\s+club/i],
  "private-events": [/private\s*event|group\s*dining|party\s+packages?/i],
  catering: [/\bcatering\b|cater\b/i],
  contact: [/contact|call\s+us|email\s+us|visit\s+us|get\s+in\s+touch/i],
  hours: [/\bhours\b|opening\s+hours|open\s+today|hours\s+of\s+operation/i],
  faq: [/\bfaq\b|frequently\s+asked|questions\b/i],
  policies: [/\bpolicy\b|terms|privacy|cancellation|refund|returns?/i],
  about: [/\babout\b|our\s+story|our\s+team|about\s+us/i],
  general: [],
};

const PAGE_TYPE_ORDER: WebsitePageType[] = [
  "reservations",
  "events",
  "menu",
  "memberships",
  "private-events",
  "catering",
  "contact",
  "hours",
  "faq",
  "policies",
  "about",
  "home",
  "general",
];

type ClassifiedPage = CrawledPage & {
  pageType: WebsitePageType;
};

function makeClassificationHaystack(page: CrawledPage) {
  const headingText = Array.isArray(page.headingText) ? page.headingText.join(" ") : "";
  const anchorText = Array.isArray(page.sourceAnchorTexts) ? page.sourceAnchorTexts.join(" ") : "";
  return {
    path: new URL(page.url).pathname.toLowerCase(),
    title: (page.title ?? "").toLowerCase(),
    headings: headingText.toLowerCase(),
    meta: (page.metaDescription ?? "").toLowerCase(),
    excerpt: (page.textExcerpt ?? "").toLowerCase(),
    anchor: anchorText.toLowerCase(),
  };
}

export function classifyPageType(page: CrawledPage): WebsitePageType {
  const haystack = makeClassificationHaystack(page);
  const scores = new Map<WebsitePageType, number>();

  for (const pageType of PAGE_TYPE_ORDER) {
    if (pageType === "general") {
      continue;
    }
    let score = 0;
    for (const hint of PAGE_TYPE_HINTS[pageType]) {
      if (hint.test(haystack.path)) score += 6;
      if (hint.test(haystack.title)) score += 7;
      if (hint.test(haystack.headings)) score += 5;
      if (hint.test(haystack.meta)) score += 3;
      if (hint.test(haystack.anchor)) score += 4;
      if (hint.test(haystack.excerpt)) score += 2;
    }
    scores.set(pageType, score);
  }

  if (haystack.path === "/" || haystack.path === "") {
    scores.set("home", (scores.get("home") ?? 0) + 8);
  }

  if (/private/.test(haystack.path) && /event|party|group/.test(haystack.path)) {
    scores.set("private-events", (scores.get("private-events") ?? 0) + 8);
  }

  if (/cater/.test(haystack.path)) {
    scores.set("catering", (scores.get("catering") ?? 0) + 10);
  }

  const best = PAGE_TYPE_ORDER.reduce<{ type: WebsitePageType; score: number }>((current, pageType) => {
    const score = scores.get(pageType) ?? (pageType === "general" ? 0 : -1);
    return score > current.score ? { type: pageType, score } : current;
  }, { type: "general", score: 0 });

  return best.score >= 5 ? best.type : "general";
}

function classifyPages(pages: CrawledPage[]): ClassifiedPage[] {
  return pages.map((page) => ({
    ...page,
    pageType: classifyPageType(page),
  }));
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&laquo;|&raquo;/gi, " ")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#\d+;/g, " ");
}

function cleanEventTitle(raw: string): string {
  const cleaned = compact(decodeHtmlEntities(raw)
    .replace(/\|\s*[^|]+$/g, "")
    .replace(/^event\s+series:\s*/i, "")
    .replace(/\bskip\s+to\s+content\b/gi, "")
    .replace(/\s{2,}/g, " "));
  return cleaned.slice(0, 120);
}

function pickEventTitleFromPage(page: CrawledPage): string {
  const heading = page.headingText?.find((entry) => entry.trim().length > 0);
  const fromHeading = heading ? cleanEventTitle(heading) : "";
  if (fromHeading) {
    return fromHeading;
  }
  const fromTitle = cleanEventTitle(page.title ?? "");
  return fromTitle || "Upcoming event";
}

function normalizeEventDescription(value: string): string {
  return compact(decodeHtmlEntities(value)
    .replace(/^.*?\bAll\s+Events\b\s*/i, "")
    .replace(/^.*?\|\s*[^|]+\|\s*[^|]+\s*/i, "")
    .replace(/\bskip\s+to\s+content\b/gi, "")
    .replace(/\badd\s+to\s+calendar\b[\s\S]*$/i, "")
    .replace(/\bcategories?:\b[\s\S]*$/i, "")
    .replace(/\bCategor(?:y|ies)?\s*:?\s*$/i, "")
    .replace(/^[-|:;,.\s]+/, ""));
}

function extractEventDateAndTime(text: string): { date: string | null; time: string | null } {
  const rangeDate = text.match(new RegExp(`(${MONTH_REGEX.source}\\s+\\d{1,2}(?:,\\s*\\d{4})?\\s*(?:-|to|–)\\s*${MONTH_REGEX.source}\\s+\\d{1,2}(?:,\\s*\\d{4})?)`, "i"));
  const singleDate = text.match(new RegExp(`(${MONTH_REGEX.source}\\s+\\d{1,2}(?:,\\s*\\d{4})?)`, "i"));
  const timeMatch = text.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b(?:\s*(?:-|to|–)\s*\d{1,2}(?::\d{2})?\s?(?:am|pm))?/i);

  return {
    date: rangeDate?.[1] ?? singleDate?.[1] ?? null,
    time: timeMatch?.[0] ?? null,
  };
}

function extractEventCategory(text: string): string {
  const categoryText = text.match(/\bcategories?:\s*([^\n]+?)(?:\badd\s+to\s+calendar\b|$)/i)?.[1] ?? "";
  const normalized = compact(decodeHtmlEntities(categoryText).replace(/\s+,\s+/g, ", "));
  if (normalized) {
    return normalized.slice(0, 90);
  }
  if (/live\s+music|music\s+bingo|dj/i.test(text)) {
    return "Live music";
  }
  if (/workshop|paint\s+and\s+sip/i.test(text)) {
    return "Workshop";
  }
  if (/dinner|prix\s+fixe|farm\s+kitchen|food/i.test(text)) {
    return "Dining event";
  }
  return "Event";
}

function eventBookingHint(text: string): string | null {
  return text.match(/(?:reservations?\s+recommended|book\s+a\s+reservation|tickets?\s+include[^.]{0,120}|rsvp[^.]{0,120}|deposit[^.]{0,140})/i)?.[0] ?? null;
}

function extractEventDescription(text: string, title: string): string {
  const normalized = normalizeEventDescription(text);
  const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const afterDateTime = normalized.match(/(?:@\s*\d{1,2}(?::\d{2})?\s?(?:am|pm)(?:\s*(?:-|to|–)\s*\d{1,2}(?::\d{2})?\s?(?:am|pm))?\s*)([\s\S]+)/i)?.[1] ?? "";
  const afterTitle = normalized.match(new RegExp(`${titleEscaped}\\s+([\\s\\S]+)`, "i"))?.[1] ?? "";
  const candidate = afterDateTime || afterTitle || normalized;
  const trimmed = normalizeEventDescription(candidate)
    .replace(/\bfind\s+out\s+more\b/gi, "")
    .replace(/\bcategor[^.]{0,80}$/i, "")
    .replace(/\bjoin\s+us\s+at\s+windmill\s+creek[^.]*\.?/gi, "");
  return trimmed.slice(0, 420);
}

// Generic event category/listing titles that should not produce individual event entries
// unless actual event content (dates + distinct titles) is present on the page.
const GENERIC_EVENT_CATEGORY_REGEX = /^(upcoming\s+events?|events?\s*calendar|what'?s\s+on|happenings?|live\s+music|live\s+entertainment|entertainment|events?|calendar|activities|shows?|performances?)$/i;

function hasStrongEventSignal(page: CrawledPage): boolean {
  const urlLower = page.url.toLowerCase();

  // Explicit event detail URL is the strongest signal
  if (/\/event\/|\/events\/[^/]+$/.test(urlLower)) return true;

  const titleLower = (page.title ?? "").toLowerCase();
  const excerptLower = (page.textExcerpt ?? "").toLowerCase().slice(0, 800);

  // Event listing/calendar page patterns based on URL or title
  if (/event\s+series|all\s+events|upcoming\s+events|what'?s\s+on|happenings|event\s+calendar/.test(`${urlLower} ${titleLower}`)) return true;

  // Date evidence: require MULTIPLE dates (calendar-like content) OR a date adjacent
  // to explicit event language — a single date alone is too noisy (e.g. founding year,
  // seasonal hours like "open March–October").
  const dateMatches = excerptLower.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s+\d{1,2}/g);
  if (dateMatches && dateMatches.length >= 2) return true;

  // Single date + explicit event-type language
  if (
    dateMatches &&
    dateMatches.length >= 1 &&
    /\b(concert|performance|show\b|band\b|musician|dj\b|ticke|rsvp\b|register\b|workshop|trivia|comedy|fundraiser|tasting\s+event|dinner\s+event|prix\s+fixe)\b/.test(excerptLower)
  ) {
    return true;
  }

  return false;
}

function rankSourceUrlForSignal(url: string, preferred: RegExp): number {
  const lower = url.toLowerCase();
  if (preferred.test(lower)) return 4;
  if (/contact|about|visit|location/.test(lower)) return 3;
  if (/home|\/$/.test(lower)) return 2;
  return 1;
}

function pickBestSignal<T extends { sourceUrl: string }>(values: T[], preferred: RegExp): T | null {
  if (!values.length) {
    return null;
  }
  return [...values]
    .sort((left, right) => rankSourceUrlForSignal(right.sourceUrl, preferred) - rankSourceUrlForSignal(left.sourceUrl, preferred))[0] ?? null;
}

type EventsExtractionResult = {
  events: ImportEvent[];
  /** True if any event-related pages were found during the crawl, even with no confirmed listings. */
  eventPagesPresent: boolean;
  /** True only when concrete dated event listings were successfully extracted. */
  currentEventsFound: boolean;
};

function extractEventsFromPages(pages: CrawledPage[], signals: ImportSignals): EventsExtractionResult {
  const events: ImportEvent[] = [];
  const seen = new Set<string>();
  const eventPages = pages.filter((page) => page.pageType === "events" || hasStrongEventSignal(page));
  const eventPagesPresent = eventPages.length > 0;
  const detailPages = eventPages.filter((page) => /\/event\//.test(page.url));
  const listingPages = eventPages.filter((page) => !/\/event\//.test(page.url));
  const orderedPages = [...detailPages, ...listingPages];

  for (const page of orderedPages) {
    const normalizedText = normalizeEventDescription(page.textExcerpt);
    const title = pickEventTitleFromPage(page);
    const dateTime = extractEventDateAndTime(normalizedText);
    const description = extractEventDescription(normalizedText, title);
    const bookingSignal = signals.bookingLinks.find((entry) => entry.sourceUrl === page.url)
      ?? signals.bookingLinks.find((entry) => /resy|opentable|tock|eventbrite|tickets?|rsvp|book/i.test(`${entry.url} ${entry.label}`));
    const bookingUrl = bookingSignal?.url ?? null;
    const bookingInfo = eventBookingHint(`${normalizedText} ${bookingSignal?.label ?? ""}`);
    const category = extractEventCategory(normalizedText);
    const recurring = /event\s+series|every\s|weekly|monthly|recurring|each\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalizedText);
    const pricing = normalizedText.match(/\$\s?\d{1,3}(?:\.\d{2})?(?:\s*(?:-|to)\s*\$\s?\d{1,3}(?:\.\d{2})?)?/i)?.[0] ?? null;
    const location = normalizedText.match(/\b(?:at|in)\s+([A-Z][A-Za-z0-9&'\-\s]{3,60})/)?.[1]?.trim() ?? null;

    if (!/\/event\//.test(page.url) && !dateTime.date) {
      continue;
    }

    const normalizedTitle = title.toLowerCase();
    if (!normalizedTitle || /skip\s+to\s+content|winery\s+events\s+in|what'?s\s+happening/.test(normalizedTitle)) {
      continue;
    }

    // For listing pages (not /event/ detail paths), reject entries whose title is
    // a generic category label ("Live Music", "Upcoming Events", etc.) unless the
    // page evidences at least two distinct dates — indicating a real event calendar.
    if (!/\/event\//.test(page.url) && GENERIC_EVENT_CATEGORY_REGEX.test(normalizedTitle)) {
      const dateMentions = (normalizedText.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s+\d{1,2}/g) ?? []).length;
      if (dateMentions < 2) {
        console.log(`[events] SKIP generic-category title="${normalizedTitle}" url=${page.url}`);
        continue;
      }
    }

    const key = `${normalizedTitle}::${dateTime.date ?? ""}::${dateTime.time ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    events.push({
      id: createId("event"),
      title,
      date: dateTime.date,
      time: dateTime.time,
      description,
      category,
      bookingInfo,
      bookingUrl,
      pricing,
      location,
      sourceUrl: page.url,
      recurring,
      include: true,
    });

    if (events.length >= 24) {
      break;
    }
  }

  const finalEvents = events
    .filter((entry) => entry.title.length >= 4)
    .slice(0, 20);

  if (eventPagesPresent && finalEvents.length === 0) {
    console.log(`[events] eventPagesPresent=true but currentEventsFound=false — event pages exist without confirmed dated listings`);
  }

  return {
    events: finalEvents,
    eventPagesPresent,
    currentEventsFound: finalEvents.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Menu section semantic-category normalisation
// ---------------------------------------------------------------------------

/** Ordered rules — first match wins. */
const MENU_CATEGORY_RULES: Array<{ pattern: RegExp; category: MenuSemanticCategory }> = [
  // Kids must be first — "Lil Hooper Troopers", "Kids Menu", etc.
  { pattern: /kids?|children|junior|lil['\s]|little\s+ones?/i, category: "kids_menu" },
  // Alcholic drinks detected before the generic "beverages" rule
  { pattern: /beer|wine|cocktail|spirits?|alcohol|bar\s*menu|liquor|whiskey|whisky|bourbon|craft\s*drinks?/i, category: "alcohol" },
  // Starters / apps
  { pattern: /starter|appetizer|app(?:etiser)?|small\s*plate|bite|to\s*start/i, category: "starters" },
  // Specific protein category
  { pattern: /seafood|fish|shell|lobster|shrimp|oyster|crab|catch/i, category: "seafood" },
  // Salad / greens
  { pattern: /salad|greens/i, category: "salads" },
  // Soup
  { pattern: /soup/i, category: "soups" },
  // Brunch
  { pattern: /brunch/i, category: "brunch" },
  // Desserts
  { pattern: /dessert|sweet|cake|ice\s*cream|pastry/i, category: "desserts" },
  // Generic non-alcoholic beverages
  { pattern: /non[‐\-\s]?alcohol|mocktail|soda|soft\s*drink|juice|iced\s+tea|lemonade|coffee|tea|beverage|drink/i, category: "beverages" },
  // Mains / entrees (keep near bottom — broad terms)
  { pattern: /entree|entre[ée]|main|dinner|lunch|mains|feature|signature/i, category: "entrees" },
];

/** Noise section titles that should be excluded from menu ingestion. */
const MENU_NOISE_TITLE_REGEX = /skip\s+to|navigation|nav|search|cart|checkout|home|footer|header|sidebar|promotions?|banner|announcement|seasonal\s+special|happy\s+hour|deal|offer/i;

/**
 * Derive a normalised semantic category for a menu section title.
 * Returns null if no rule matches (caller can use "other").
 */
function normalizeMenuSectionCategory(title: string): MenuSemanticCategory | null {
  for (const rule of MENU_CATEGORY_RULES) {
    if (rule.pattern.test(title)) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Detect sections that are noisy / non-food content and should be excluded.
 */
function isNoiseMenuSection(title: string, items: ImportMenuItem[]): boolean {
  if (MENU_NOISE_TITLE_REGEX.test(title)) return true;
  // A section with a single item whose name exactly echoes the section title is
  // likely a navigation/teaser artefact rather than a real section.
  if (items.length === 1 && items[0] && items[0].name.toLowerCase().trim() === title.toLowerCase().trim()) return true;
  return false;
}

function extractMenuSectionsFromPages(pages: CrawledPage[]): ImportMenuSection[] {
  const menuPages = pages.filter((page) => {
    // Skip home pages — their headings are often event titles, not menu sections
    if ((page as ClassifiedPage).pageType === "home") return false;
    // Include explicitly classified menu pages, plus URL/title heuristics.
    // Broader pattern than classifyPageType so that pages classified as "general"
    // but containing menu content are still processed.
    return (
      (page as ClassifiedPage).pageType === "menu" ||
      /\bmenu\b|\bfood\b|\bwine\s+list\b|\bcocktail\b|\bbrunch\b|\bdinner\b|\bdining\b|\bdrinks?\b|\beats?\b|\blunch\b|\border\s+online\b/i
        .test(`${page.url} ${page.title}`)
    );
  });

  console.log(`[menu] Scanning ${menuPages.length} menu-candidate pages (total pages: ${pages.length})`);
  for (const p of menuPages) {
    console.log(`[menu]   ${(p as ClassifiedPage).pageType ?? "general"} | ${new URL(p.url).pathname} — "${p.title.slice(0, 60)}"`);
  }

  const sections: ImportMenuSection[] = [];

  for (const page of menuPages) {
    const rawText = compact(page.textExcerpt);
    const text = rawText;
    const structuredText = page.structuredText ?? "";

    const hasStructuredHeadings = structuredText.includes("##");
    const hasPriceSignals = /\$\s?\d/.test(text);
    const headingCount = (page.headingText ?? []).filter((h) => h.length >= 3 && h.length <= 60).length;
    console.log(`[menu] ${new URL(page.url).pathname}: structuredHeadings=${hasStructuredHeadings} priceSignals=${hasPriceSignals} headings=${headingCount} textLen=${text.length}`);

    // Try heading-based structured parsing first (## Section / - Item lines)
    const structuredSections = parseStructuredMenuText(structuredText, page);
    if (structuredSections.length > 0) {
      console.log(`[menu] ${new URL(page.url).pathname}: structured-text → ${structuredSections.length} sections`);
      sections.push(...structuredSections);
      continue;
    }
    if (hasStructuredHeadings) {
      console.log(`[menu] ${new URL(page.url).pathname}: structuredText had ## but parseStructuredMenuText found 0 sections — text may have items only under root headings`);
    }

    // Try price-pattern parsing
    const priceSections = parsePricePatternMenu(text, page);
    if (priceSections.length > 0) {
      console.log(`[menu] ${new URL(page.url).pathname}: price-pattern → ${priceSections.length} sections`);
      sections.push(...priceSections);
      continue;
    }
    if (!hasPriceSignals) {
      console.log(`[menu] ${new URL(page.url).pathname}: no $price signals found — price-pattern skipped`);
    }

    // Try text-block heuristic parsing (for plain text menus without prices)
    const heuristicSections = parseTextBlockMenu(text, page);
    if (heuristicSections.length > 0) {
      console.log(`[menu] ${new URL(page.url).pathname}: text-block → ${heuristicSections.length} sections`);
      sections.push(...heuristicSections);
      continue;
    }


    // Final fallback: single overview section
    const fallbackTitle = page.title || "Menu";
    sections.push({
      id: createId("menu_section"),
      title: fallbackTitle,
      semanticCategory: normalizeMenuSectionCategory(fallbackTitle) ?? "other",
      sourceUrl: page.url,
      include: true,
      items: [{
        id: createId("menu_item"),
        name: "Menu overview",
        price: null,
        description: text.slice(0, 280),
        dietaryNotes: /vegan|vegetarian|gluten|allergy|dairy/i.test(text) ? "Contains dietary notes on page" : null,
        include: true,
      }],
    });
  }

  // Remove noise sections (navigation artefacts, promotional blocks, etc.)
  const cleaned = sections.filter((s) => {
    const isNoise = isNoiseMenuSection(s.title, s.items);
    if (isNoise) {
      console.log(`[menu] DISCARD noise section "${s.title.slice(0, 50)}" items=${s.items.length}`);
    }
    return !isNoise;
  });
  console.log(`[menu] ${sections.length} total sections → ${cleaned.length} after noise filtering`);
  return cleaned.slice(0, 12);
}

function parseStructuredMenuText(structuredText: string, page: CrawledPage): ImportMenuSection[] {
  if (!structuredText || !structuredText.includes("##")) {
    return [];
  }

  const lines = structuredText.split("\n");
  const sections: ImportMenuSection[] = [];
  let currentSection: { title: string; items: ImportMenuItem[] } | null = null;
  const dietaryText = structuredText.toLowerCase();
  const hasDietaryNotes = /vegan|vegetarian|gluten|allergy|dairy/i.test(dietaryText);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heading = new section
    if (trimmed.startsWith("## ")) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push({
          id: createId("menu_section"),
          title: currentSection.title,
          semanticCategory: normalizeMenuSectionCategory(currentSection.title) ?? "other",
          sourceUrl: page.url,
          include: true,
          items: currentSection.items.slice(0, 20),
        });
      }
      currentSection = { title: trimmed.slice(3).trim(), items: [] };
      continue;
    }

    if (!currentSection) continue;

    // Parse item line: "- Item name" or "- Item name $12.99" or "Item name ... $12"
    const itemText = trimmed.startsWith("- ") ? trimmed.slice(2).trim() : trimmed;
    if (itemText.length < 3 || itemText.length > 120) continue;

    // Skip noise lines
    if (/^(skip to|main menu|cart|checkout|search|share|follow|copyright|all rights)/i.test(itemText)) continue;

    const priceMatch = itemText.match(/^(.+?)\s+\$\s?(\d{1,3}(?:\.\d{2})?)\s*$/);
    const name = priceMatch ? priceMatch[1].trim() : itemText;
    const price = priceMatch ? `$${priceMatch[2]}` : null;

    // Skip if name is too short or looks like navigation
    if (name.length < 2 || /^(home|back|next|previous|menu|close)$/i.test(name)) continue;

    // Try to extract description: text after a dash, period, or colon
    const descMatch = name.match(/^([^–—:]{3,50})\s*[–—:]\s*(.+)$/);
    const itemName = descMatch ? descMatch[1].trim() : name.slice(0, 60);
    const description = descMatch ? descMatch[2].trim().slice(0, 160) : "";

    currentSection.items.push({
      id: createId("menu_item"),
      name: itemName,
      price,
      description,
      dietaryNotes: hasDietaryNotes ? "Contains dietary notes on page" : null,
      include: true,
    });
  }

  // Push last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push({
      id: createId("menu_section"),
      title: currentSection.title,
      semanticCategory: normalizeMenuSectionCategory(currentSection.title) ?? "other",
      sourceUrl: page.url,
      include: true,
      items: currentSection.items.slice(0, 20),
    });
  }

  return sections;
}

function parsePricePatternMenu(text: string, page: CrawledPage): ImportMenuSection[] {
  const headingCandidate = page.headingText?.find((entry) => /menu|food|wine|cocktail|brunch|dinner/i.test(entry));
  const sectionTitle = headingCandidate || page.title || "Menu";
  const priceMatches = Array.from(text.matchAll(/([^.$\n]{3,60})\s+\$\s?(\d{1,3}(?:\.\d{2})?)/g));

  if (priceMatches.length === 0) return [];

  // Group items by nearby headings if available
  const hasDietaryNotes = /vegan|vegetarian|gluten|allergy|dairy/i.test(text);
  const items: ImportMenuItem[] = priceMatches.slice(0, 20).map((match) => ({
    id: createId("menu_item"),
    // .slice(0, 48) — take the FIRST 48 chars (was erroneously .slice(-48) which took the last 48)
    name: compact((match[1] ?? "Item").replace(/[^a-zA-Z0-9&,'\-\s]/g, "")).slice(0, 48) || "Menu item",
    price: `$${match[2]}`,
    description: "",
    dietaryNotes: hasDietaryNotes ? "Contains dietary notes on page" : null,
    include: true,
  }));

  return [{
    id: createId("menu_section"),
    title: sectionTitle,
    semanticCategory: normalizeMenuSectionCategory(sectionTitle) ?? "other",
    sourceUrl: page.url,
    include: true,
    items,
  }];
}

function parseTextBlockMenu(text: string, page: CrawledPage): ImportMenuSection[] {
  // Look for heading patterns in page headingText that could delineate sections
  const headings = page.headingText ?? [];
  const menuHeadings = headings.filter((h) =>
    h.length >= 3 && h.length <= 60
    && !/skip|(?:^|\s)menu(?:$|\s)|navigation|search|cart|home|back/i.test(h)
    && !/^\d+$/.test(h),
  );

  // Allow single-heading pages — a menu page can have just one major section heading.
  // A single heading with substantive text beneath it is still extractable.
  if (menuHeadings.length < 1) return [];

  // Heuristic: if a page has multiple short headings and text between them,
  // treat each heading as a menu section
  const sections: ImportMenuSection[] = [];
  const hasDietaryNotes = /vegan|vegetarian|gluten|allergy|dairy/i.test(text);

  for (const heading of menuHeadings) {
    const headingIndex = text.indexOf(heading);
    if (headingIndex < 0) continue;

    // Find text between this heading and next heading
    let nextHeadingIndex = text.length;
    for (const other of menuHeadings) {
      if (other === heading) continue;
      const idx = text.indexOf(other, headingIndex + heading.length);
      if (idx > headingIndex && idx < nextHeadingIndex) {
        nextHeadingIndex = idx;
      }
    }

    const sectionText = text.slice(headingIndex + heading.length, nextHeadingIndex).trim();
    if (sectionText.length < 10) continue;

    // Parse items from text: split by line-like boundaries
    const itemCandidates = sectionText
      .split(/\s{2,}|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 80)
      .filter((s) => !/^(skip|copyright|all rights|share|follow)/i.test(s));

    if (itemCandidates.length === 0) continue;

    const items: ImportMenuItem[] = itemCandidates.slice(0, 20).map((candidate) => {
      const priceMatch = candidate.match(/^(.+?)\s+\$\s?(\d{1,3}(?:\.\d{2})?)\s*$/);
      const descMatch = candidate.match(/^([^–—:]{3,50})\s*[–—:]\s*(.+)$/);

      return {
        id: createId("menu_item"),
        name: (priceMatch ? priceMatch[1] : descMatch ? descMatch[1] : candidate).trim().slice(0, 60),
        price: priceMatch ? `$${priceMatch[2]}` : null,
        description: descMatch ? descMatch[2].trim().slice(0, 160) : "",
        dietaryNotes: hasDietaryNotes ? "Contains dietary notes on page" : null,
        include: true,
      };
    });

    sections.push({
      id: createId("menu_section"),
      title: heading,
      semanticCategory: normalizeMenuSectionCategory(heading) ?? "other",
      sourceUrl: page.url,
      include: true,
      items,
    });
  }

  return sections;
}

// Strong signal for an actual reservation system vs. a generic contact/inquiry form.
// "table", "book" alone, and "experience" are explicitly excluded — they match too many
// non-reservation contexts (e.g. "picnic table", "cookbook", "tasting experience").
const STRONG_RESERVATION_REGEX = /\breserv(?:e|ation|ations|ed)?\b|\bopentable\b|\bresy(?:\.com)?\b|\bsevenrooms\b|\btock(?:\.com)?\b|\bexploretock\b|\btoasttab\b|\bbook\s+a\s+(?:table|reservation|seat)\b|\bmake\s+a\s+(?:reservation|booking)\b|\breservation\s+(?:required|recommended|policy)\b/i;

function extractReservationInfo(pages: CrawledPage[], signals: ImportSignals): ImportReservationInfo {
  // Only count pages with explicit, unambiguous reservation language; "experience",
  // "table", and standalone "book" are excluded because they appear on almost every
  // restaurant page and produce false positives.
  const reservationPages = pages.filter(
    (page) =>
      page.pageType === "reservations" ||
      page.pageType === "private-events" ||
      STRONG_RESERVATION_REGEX.test(`${page.url} ${page.title} ${page.textExcerpt.slice(0, 320)}`),
  );

  // A real booking platform link is strong independent evidence of a reservation system
  const platformBookingSignal =
    signals.bookingLinks.find((l) => BOOKING_PLATFORM_REGEX.test(l.url)) ?? null;
  const bookingSignal = platformBookingSignal ?? signals.bookingLinks[0] ?? null;

  if (!reservationPages.length && !bookingSignal) {
    console.log(`[reservations] status=not-offered — no reservation pages found and no booking links detected`);
    return {
      status: "not-offered",
      include: false,
      sourceUrl: null,
      bookingUrl: null,
      platforms: [],
      instructions: "",
      partySizeNotes: null,
      depositPolicy: null,
      experienceNotes: null,
    };
  }

  // Strip platform boilerplate (Squarespace scheduling text, accessibility skip links, etc.)
  // before evaluating content quality — polluted text can falsely exceed the length threshold.
  const joined = stripBoilerplateText(compact(reservationPages.map((entry) => `${entry.title}. ${entry.textExcerpt}`).join(" ")));
  // Only use the source page URL as bookingUrl when it matches a booking platform.
  // Falling back to a generic reservation page URL inflates confidence.
  const confirmedBookingUrl =
    bookingSignal?.url
    ?? reservationPages.find((entry) => /resy|opentable|tock|sevenrooms|toasttab/i.test(`${entry.url} ${entry.textExcerpt}`))?.url
    ?? null;
  const bookingUrl = confirmedBookingUrl;
  const platforms = ["resy", "opentable", "tock", "sevenrooms", "toast"].filter((platform) => new RegExp(platform, "i").test(`${joined} ${bookingUrl ?? ""}`));

  // "confirmed" = explicit booking platform URL was found, or meaningful booking
  // instructions were extracted from reservation pages. "page-exists-unconfirmed" =
  // reservation pages exist but no actionable booking details were confirmed.
  // Require reservation-relevant terms in the cleaned text to avoid false positives
  // from generic pages (e.g., a contact page that happened to pass the filter).
  const hasLikelyBookingUrl = !!(platformBookingSignal?.url ?? (bookingUrl && /resy|opentable|tock|sevenrooms|toasttab|book|reserv/i.test(bookingUrl)));
  const hasSubstantialInstructions =
    joined.length > 60 && /reserv(ation)?|book(ing)?|table|walk.?in|opentable|resy|tock|sevenrooms/i.test(joined);
  const status: ReservationStatus =
    hasLikelyBookingUrl || hasSubstantialInstructions ? "confirmed" : "page-exists-unconfirmed";

  console.log(
    `[reservations] status=${status} reservationPages=${reservationPages.length} bookingSignal=${bookingSignal?.url ?? "none"}` +
    ` platformSignal=${platformBookingSignal?.url ?? "none"} hasInstructions=${hasSubstantialInstructions}`,
  );
  for (const p of reservationPages) {
    const matchReason = p.pageType === "reservations" ? "pageType=reservations"
      : p.pageType === "private-events" ? "pageType=private-events"
      : `regex match in ${new URL(p.url).pathname}`;
    console.log(`[reservations]   + ${matchReason} — "${p.title.slice(0, 60)}"`);
  }

  return {
    status,
    include: true, // status is confirmed or page-exists-unconfirmed here; not-offered was returned early above
    sourceUrl: reservationPages[0]?.url ?? bookingSignal?.sourceUrl ?? null,
    bookingUrl,
    platforms,
    instructions: (joined || bookingSignal?.label || "").slice(0, 360),
    partySizeNotes: joined.match(/party[^.]{0,100}|group[^.]{0,100}/i)?.[0] ?? null,
    depositPolicy: joined.match(/(?:\$\d+\s+)?deposit[^.]{0,120}|cancellation[^.]{0,120}/i)?.[0] ?? null,
    experienceNotes: joined.match(/experience[^.]{0,140}|special[^.]{0,140}/i)?.[0] ?? null,
  };
}

function extractMembershipInfo(pages: CrawledPage[]): ImportMembershipInfo {
  const memberPage = pages.find((page) => page.pageType === "memberships" || /club|membership|wine\s*club|loyalty/i.test(`${page.url} ${page.title}`));
  if (!memberPage) {
    return {
      include: false,
      sourceUrl: null,
      name: "",
      benefits: "",
      pickupDetails: null,
      signupUrl: null,
      memberEventNotes: null,
    };
  }

  const text = compact(memberPage.textExcerpt);

  return {
    include: true,
    sourceUrl: memberPage.url,
    name: memberPage.title || "Membership",
    benefits: text.slice(0, 320),
    pickupDetails: text.match(/pickup[^.]{0,120}/i)?.[0] ?? null,
    signupUrl: memberPage.url,
    memberEventNotes: text.match(/member[^.]{0,140}event[^.]{0,140}|event[^.]{0,140}member[^.]{0,140}/i)?.[0] ?? null,
  };
}

function scorePolicyCandidate(title: string, summary: string, sourceUrl: string | null): number {
  let score = 0;
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedSummary = summary.trim().toLowerCase();
  const source = (sourceUrl ?? "").toLowerCase();

  if (POLICY_HINT_REGEX.test(normalizedTitle)) {
    score += 3;
  }

  if (POLICY_HINT_REGEX.test(normalizedSummary)) {
    score += 2;
  }

  if (source && POLICY_HINT_REGEX.test(source)) {
    score += 2;
  }

  if (summary.length >= 40 && summary.length <= 360) {
    score += 2;
  } else {
    score -= 2;
  }

  if (sentenceCount(summary) >= 1) {
    score += 1;
  }

  if (POLICY_NOISE_REGEX.test(normalizedTitle) || POLICY_NOISE_REGEX.test(normalizedSummary)) {
    score -= 6;
  }

  return score;
}

function asNullableUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Content-driven FAQ extraction                                      */
/* ------------------------------------------------------------------ */

const QUESTION_HEADING_REGEX = /^(what|when|where|who|why|how|can|do|does|is|are|will|did|should|could|would)\b/i;
const FAQ_CONTENT_PAGES: Set<WebsitePageType> = new Set(["faq", "policies", "about", "contact", "general", "memberships", "private-events", "reservations", "hours"]);

/**
 * Sanitize crawled text for FAQ extraction — strip URLs, social noise, navigation, HTML entities, page titles.
 */
function sanitizeFaqText(value: string): string {
  return value
    // Strip page title patterns (e.g., "Title | Business Name | City, ST")
    .replace(/[^\n.!?]*\|[^\n.!?]*(?:\|[^\n.!?]*)*/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\/[a-z0-9\-_]+\?(?:[^\s]{6,})/gi, " ")
    .replace(/&hellip;/gi, "...")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/gi, " ")
    .replace(/\[\s*&hellip;\s*\]/gi, "")
    .replace(/\[…\]/gi, "")
    .replace(/\bshare\s+on\b/gi, " ")
    .replace(/\bsee\s+more\b/gi, " ")
    .replace(/\bfind\s+out\s+more\b/gi, " ")
    .replace(/\bread\s+more\b/gi, " ")
    .replace(/\bcomments?\b/gi, " ")
    .replace(/\blikes?\b/gi, " ")
    .replace(/\bcopy\s+link\b/gi, " ")
    .replace(/\bretweet\b/gi, " ")
    .replace(/\bpinterest\b/gi, " ")
    .replace(/\badd\s+to\s+calendar\b/gi, " ")
    .replace(/(?:skip\s+to\s+content|main\s+menu|privacy\s+policy|terms)\b[^?.!\n]*/gi, " ")
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\s+(?:farm\s+kitchen\s+events?|winery\s+events?)/gi, " ")
    .replace(/\+\d+\)/g, " ") // strip menu price modifier "+2)"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert a raw informational answer into a concise, chatbot-style response.
 * Rules: 2-3 sentences max, sounds like a chatbot speaking to a guest.
 */
function toConversationalAnswer(rawAnswer: string): string {
  let cleaned = rawAnswer
    // Decode HTML entities
    .replace(/&hellip;/gi, "...")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/gi, " ")
    .replace(/\[\s*…\s*\]/g, "")
    .replace(/\[\s*&hellip;\s*\]/gi, "")
    // Strip URLs and query params
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b\w+\s*=\s*\w+/g, "")
    // Strip page title patterns: "Something | Business Name | City, ST"
    .replace(/[^.!?\n]*\|[^.!?\n]*(?:\|[^.!?\n]*)*/g, " ")
    // Strip nav/UI noise
    .replace(/\b(?:skip\s+to\s+content|main\s+menu|open\s+menu|close\s+menu)\b/gi, "")
    .replace(/\bfind\s+out\s+more\b/gi, "")
    .replace(/\bread\s+more\b/gi, "")
    .replace(/\badd\s+to\s+calendar\b/gi, "")
    .replace(/\bbook\s+a\s+reservation\b/gi, "")
    .replace(/\b(?:share|follow|subscribe|newsletter|log\s*in|sign\s*in)\b/gi, "")
    // Strip date-prefixed event noise: "Mar 13 Live Music Piano..."
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(?:Live\s+Music|Event|Farm\s+Kitchen)[^.!?]*/gi, "")
    // Strip event listing fragments: "Category: ... Add to Calendar"
    .replace(/\bCategor(?:y|ies)?\s*:?\s*[^.!?]*/gi, "")
    // Strip "+N)" price modifier patterns from menus
    .replace(/\+\d+\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.!?\-–—]+/, "")
    .trim();

  if (!cleaned) return "";

  // Strip leading heading/title text that precedes actual content.
  // Detects patterns like "The Tasting Experience Our wine tastings..."
  // or "Wine Club at Windmill Creek Enjoy more..."
  // where a title-case phrase (with optional connecting words) leaks in before actual content.
  cleaned = cleaned.replace(
    /^((?:[A-Z][a-z]+|at|in|of|the|and|&|for|with|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|at|in|of|the|and|&|for|with|[A-Z]{2,})){1,8})\s+((?:Our|We|The|This|You|It|They|A|An|Enjoy|Membership|Join|Get|As|For|Check|Visit|All|Whether|From|With|Is|Are)\b)/,
    (_, _heading, sentenceStart) => sentenceStart,
  );

  // Capitalize first letter if it starts lowercase (e.g., mid-sentence fragment)
  if (/^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Strip leading standalone heading-like noise words that aren't part of a sentence
  cleaned = cleaned.replace(/^(Reservations?|Overview|Details|Information|Description|Summary|Introduction|The\s+Tasting\s+Experience)\s+/i, "").trim();

  // Split into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 240)
    // Reject noise sentences
    .filter((s) => !/^(skip|copyright|all rights|share|follow|subscribe|cookie)/i.test(s))
    .filter((s) => !/^\d{4}\s+(wine|farm|winery|event)/i.test(s))
    // Reject sentences that are just page/section titles (capitalized words with no verb)
    .filter((s) => !/^[A-Z][a-z]+(\s+[A-Z][a-z]+){2,}\s*[.!?]?$/.test(s))
    // Reject sentences starting with truncated words (missing first letter)
    .filter((s) => !/^[a-z]{2,}\s+[A-Z]/.test(s))
    // Reject sentences with pipe characters (page title remnants)
    .filter((s) => !s.includes("|"))
    // Reject sentences that end with a preposition/article (sign of truncation)
    .filter((s) => !/\b(?:for|to|at|in|on|with|the|a|an|and|or|but|of|from|by)\s*[.!?]?$/.test(s));

  if (sentences.length === 0) {
    // If no clean sentences, just take the first meaningful chunk
    const fallback = cleaned
      .replace(/^[a-z]+\s+/, "") // strip leading truncated word
      .slice(0, 200).replace(/\s+\S*$/, "").trim();
    return fallback && fallback.length >= 15 ? (fallback.endsWith(".") ? fallback : `${fallback}.`) : "";
  }

  // Take first 2-3 sentences, but truncate at sentence boundaries within limit
  let answer = "";
  for (const s of sentences.slice(0, 3)) {
    const next = answer ? `${answer} ${s}` : s;
    if (next.length > 350) break;
    answer = next;
  }
  answer = answer.trim();

  // Ensure it ends with a period
  if (answer && !/[.!?]$/.test(answer)) {
    answer += ".";
  }

  return answer;
}

/**
 * Validate an FAQ answer meets minimum quality standards.
 * Returns the answer if valid, null if it's garbage.
 */
function validateFaqAnswer(answer: string): string | null {
  if (!answer || answer.length < 15) return null;

  // Reject answers with query params, HTML artifacts, or numeric garbage
  if (/[&=?]\w+=|dateTime|partySize|utm_|fbclid|gclid/.test(answer)) return null;

  // Reject answers containing page title pipe patterns
  if (/\|/.test(answer)) return null;

  // Must have at least 4 real words
  const words = answer.split(/\s+/).filter((w) => w.length >= 2 && !/^[&=?#]/.test(w));
  if (words.length < 4) return null;

  // Reject if it starts with a truncated word (lowercase fragment before uppercase)
  if (/^[a-z]{2,}\s+[A-Z]/.test(answer)) {
    const fixed = answer.replace(/^[a-z]+\s+/, "").trim();
    if (fixed.length >= 15) return fixed.slice(0, 280);
    return null;
  }

  // Reject if it starts with a page title pattern
  const cleaned = answer
    .replace(/^[^a-zA-Z]*/, "") // strip leading punctuation
    .replace(/^(?:[A-Z][a-z]+\s+){0,3}(?:in|at)\s+[A-Z][a-z]+[^.]*\|\s*[^|]+(?:\|[^?]*)?(\?|\.)\s*/i, "") // strip "Title in City | Business Name."
    .trim();

  if (cleaned.length >= 15 && cleaned !== answer) {
    return cleaned.slice(0, 280);
  }

  return answer;
}

/**
 * Extract FAQ candidates from actual FAQ page structure using headings + content.
 * Looks for ## heading patterns in structuredText where headings are questions.
 */
function extractFaqsFromStructuredPage(page: CrawledPage & { pageType?: WebsitePageType }): WebsiteImportDraft["faqs"] {
  const out: WebsiteImportDraft["faqs"] = [];
  const structuredText = page.structuredText;
  if (!structuredText) return out;

  const lines = structuredText.split("\n");
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join(" ").trim() });
      }
      currentHeading = trimmed.slice(3).trim();
      currentBody = [];
    } else if (trimmed && currentHeading) {
      currentBody.push(trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed);
    }
  }
  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join(" ").trim() });
  }

  const isFaqPage = isLikelyFaqPage(page.url, page.title);

  for (const section of sections) {
    const heading = section.heading;
    const body = sanitizeFaqText(section.body);
    if (!body || body.length < 15) continue;

    // Check if heading is a question
    const isQuestion = heading.endsWith("?") || QUESTION_HEADING_REGEX.test(heading);

    if (isQuestion) {
      const question = heading.endsWith("?") ? heading : `${heading}?`;
      const answer = toConversationalAnswer(body);
      if (!answer || answer.length < 15) continue;

      out.push({
        id: createId("faq"),
        question,
        answer,
        sourceUrl: page.url,
        include: true,
        confidence: isFaqPage ? 0.92 : 0.82,
        lowConfidence: false,
      });
    } else if (isFaqPage && body.length >= 20) {
      // On FAQ pages, treat non-question headings as implicit questions
      const question = inferQuestionFromHeading(heading);
      if (question) {
        const answer = toConversationalAnswer(body);
        if (answer && answer.length >= 15) {
          out.push({
            id: createId("faq"),
            question,
            answer,
            sourceUrl: page.url,
            include: true,
            confidence: 0.78,
            lowConfidence: false,
          });
        }
      }
    }
  }

  return out.slice(0, 20);
}

/**
 * Infer a question from a heading that doesn't end with "?".
 * E.g., "Dog Policy" → "What is your dog policy?"
 *        "Parking" → "Where can I park?"
 *        "Dress Code" → "What is your dress code?"
 */
function inferQuestionFromHeading(heading: string): string | null {
  const h = heading.toLowerCase().trim();
  if (h.length < 3 || h.length > 80) return null;
  if (/^(skip|copyright|all rights|share|follow|menu|navigation|search|home|back|close)/i.test(h)) return null;

  const inferenceMap: Array<{ pattern: RegExp; question: string }> = [
    { pattern: /^dog|pet/i, question: "Do you allow dogs or pets?" },
    { pattern: /^parking/i, question: "Where can I park?" },
    { pattern: /^dress\s*code/i, question: "Is there a dress code?" },
    { pattern: /^reservation/i, question: "Do I need a reservation?" },
    { pattern: /^cancel/i, question: "What is your cancellation policy?" },
    { pattern: /^refund/i, question: "What is your refund policy?" },
    { pattern: /^hours|opening/i, question: "What are your hours?" },
    { pattern: /^location|directions?|getting\s+here/i, question: "Where are you located?" },
    { pattern: /^private\s*event/i, question: "Do you host private events?" },
    { pattern: /^weddings?/i, question: "Do you host weddings?" },
    { pattern: /^group|large\s*part/i, question: "Can you accommodate large groups?" },
    { pattern: /^kids?|children|family|families/i, question: "Are you family-friendly?" },
    { pattern: /^live\s*music/i, question: "Do you have live music?" },
    { pattern: /^wine\s*club|membership/i, question: "Do you have a wine club or membership?" },
    { pattern: /^tasting/i, question: "Do you offer tastings?" },
    { pattern: /^gift\s*card/i, question: "Do you sell gift cards?" },
    { pattern: /^delivery|takeout|to.go/i, question: "Do you offer delivery or takeout?" },
    { pattern: /^gluten|allerg|dietary/i, question: "Can you accommodate dietary restrictions?" },
    { pattern: /^smoking/i, question: "What is your smoking policy?" },
    { pattern: /^age|minors?|21/i, question: "Is there an age requirement?" },
    { pattern: /^outdoor|patio/i, question: "Do you have outdoor seating?" },
    { pattern: /^catering/i, question: "Do you offer catering?" },
    { pattern: /^wi.?fi|wifi/i, question: "Do you have Wi-Fi?" },
  ];

  for (const { pattern, question } of inferenceMap) {
    if (pattern.test(h)) return question;
  }

  // Generic: "What about [heading]?"
  if (h.length >= 4 && h.length <= 50) {
    return `What is your ${heading.toLowerCase()} policy?`;
  }

  return null;
}

/**
 * Extract FAQ candidates from policy / informational pages by detecting
 * paragraphs that describe rules, policies, or restrictions.
 */
function extractFaqsFromPolicyContent(page: CrawledPage & { pageType?: WebsitePageType }): WebsiteImportDraft["faqs"] {
  const out: WebsiteImportDraft["faqs"] = [];
  const text = sanitizeFaqText(page.textExcerpt);
  if (text.length < 40) return out;

  const pageType = page.pageType ?? "general";
  // Skip event listing pages — they produce noisy FAQ candidates
  if (pageType === "events") return out;
  if (/\/event\//.test(page.url)) return out;
  // Skip pages that are mostly event listings (upcoming-events, calendar, etc.)
  if (/upcoming|calendar|happenings|what.?s.?on|organizer/i.test(page.url)) return out;
  const haystack = `${page.url} ${page.title}`.toLowerCase();

  // Topic-specific patterns to detect and convert into Q&A
  const topicDetectors: Array<{
    pattern: RegExp;
    question: string;
    pageTypes: Set<WebsitePageType>;
  }> = [
    { pattern: /\b(?:dogs?|pets?)\s+(?:are|welcome|allowed|not\s+allowed|prohibited|permitted)/i, question: "Do you allow dogs or pets?", pageTypes: new Set(["faq", "policies", "about", "general"]) },
    { pattern: /\b(?:reservations?\s+(?:are\s+)?(?:required|recommended|suggested|not\s+required|optional))/i, question: "Do I need a reservation?", pageTypes: new Set(["faq", "policies", "reservations", "general", "about"]) },
    { pattern: /\b(?:dress\s+code|attire|casual|formal\s+wear)/i, question: "Is there a dress code?", pageTypes: new Set(["faq", "policies", "general"]) },
    { pattern: /\b(?:parking\s+(?:is|lot|garage|available|free|validation))/i, question: "Where can I park?", pageTypes: new Set(["faq", "policies", "contact", "general", "about"]) },
    { pattern: /\b(?:private\s+event|host\s+(?:an?\s+)?event|private\s+dining|private\s+room)/i, question: "Do you host private events?", pageTypes: new Set(["faq", "private-events", "general"]) },
    { pattern: /\b(?:cancellation|cancel(?:ing|led)?|no.shows?)\b/i, question: "What is your cancellation policy?", pageTypes: new Set(["faq", "policies", "reservations", "general"]) },
    { pattern: /\b(?:large\s+(?:group|part)|group\s+dining|parties?\s+of\s+\d)/i, question: "Can you accommodate large groups?", pageTypes: new Set(["faq", "policies", "reservations", "general", "private-events"]) },
    { pattern: /\b(?:outdoor\s+(?:seating|dining|patio)|patio\s+(?:seating|dining|area))/i, question: "Do you have outdoor seating?", pageTypes: new Set(["faq", "about", "general"]) },
    { pattern: /\b(?:kids?|children|family.friendly|high\s+chair)/i, question: "Are you family-friendly?", pageTypes: new Set(["faq", "policies", "general"]) },
    { pattern: /\b(?:gluten.free|vegan|vegetarian|allerg|dietary\s+(?:restrict|accommodat))/i, question: "Can you accommodate dietary restrictions?", pageTypes: new Set(["faq", "policies", "about", "general"]) },
    { pattern: /\b(?:gift\s+card|gift\s+certificate)/i, question: "Do you sell gift cards?", pageTypes: new Set(["faq", "general"]) },
    { pattern: /\b(?:live\s+music|live\s+entertainment|band|musician)/i, question: "Do you have live music?", pageTypes: new Set(["faq", "events", "general", "about"]) },
    { pattern: /\b(?:tasting\s+(?:room|experience|flight)|wine\s+tasting)/i, question: "Do you offer tastings?", pageTypes: new Set(["faq", "about", "general", "memberships"]) },
    { pattern: /\b(?:corkage|bring\s+(?:your\s+own|outside)\s+(?:wine|alcohol|beverage))/i, question: "Can I bring my own wine?", pageTypes: new Set(["faq", "policies", "general"]) },
    { pattern: /\b(?:smoking|vaping|smoke.free)/i, question: "What is your smoking policy?", pageTypes: new Set(["faq", "policies", "general"]) },
    { pattern: /\b(?:wi.?fi|wifi|internet\s+access)/i, question: "Do you have Wi-Fi?", pageTypes: new Set(["faq", "general"]) },
  ];

  for (const detector of topicDetectors) {
    if (!detector.pageTypes.has(pageType) && !detector.pattern.test(haystack)) continue;
    if (!detector.pattern.test(text)) continue;
    if (out.some((f) => f.question === detector.question)) continue;

    // Extract answer from structuredText sections when available (higher quality)
    const structuredText = page.structuredText;
    let rawAnswer = "";

    if (structuredText) {
      // Find the section that contains the match
      const sections = structuredText.split(/\n##\s+/);
      for (const section of sections) {
        if (detector.pattern.test(section)) {
          // Take the body of the section (skip the heading line)
          const lines = section.split("\n");
          const body = lines.slice(1).join(" ").trim();
          if (body.length >= 20) {
            rawAnswer = body;
            break;
          }
        }
      }
    }

    // Fallback: extract from plain text, finding sentence-aligned window
    if (!rawAnswer) {
      const match = detector.pattern.exec(text);
      if (!match) continue;

      // Find the sentence containing the match — limit lookback to 120 chars
      const lookbackStart = Math.max(0, match.index - 120);
      const beforeMatch = text.slice(lookbackStart, match.index);
      const lastPeriod = beforeMatch.lastIndexOf(". ");
      const lastExcl = beforeMatch.lastIndexOf("! ");
      const sentenceBreak = Math.max(lastPeriod, lastExcl);
      const sentenceStart = sentenceBreak >= 0
        ? lookbackStart + sentenceBreak + 2
        : match.index; // If no sentence break found nearby, start at match

      const afterMatch = text.slice(match.index + match[0].length);
      const sentenceEnd = afterMatch.search(/[.!]\s/);
      const end = sentenceEnd >= 0
        ? match.index + match[0].length + sentenceEnd + 1
        : Math.min(text.length, match.index + match[0].length + 200);

      rawAnswer = text.slice(sentenceStart, end).trim();

      // If we got a very long chunk, just grab from the match onward
      if (rawAnswer.length > 300) {
        rawAnswer = text.slice(match.index, end).trim();
      }
    }

    const answer = validateFaqAnswer(toConversationalAnswer(rawAnswer));
    if (!answer) continue;

    out.push({
      id: createId("faq"),
      question: detector.question,
      answer,
      sourceUrl: page.url,
      include: true,
      confidence: pageType === "faq" || pageType === "policies" ? 0.88 : 0.75,
      lowConfidence: false,
    });
  }

  return out.slice(0, 10);
}

/**
 * Extract FAQs from question marks in page text (original fallback approach, improved).
 */
function extractQuestionMarkFaqs(page: CrawledPage & { pageType?: WebsitePageType }): WebsiteImportDraft["faqs"] {
  const out: WebsiteImportDraft["faqs"] = [];
  const faqPageHint = isLikelyFaqPage(page.url, page.title);
  const sanitizedExcerpt = sanitizeFaqText(page.textExcerpt);
  const questionPattern = /([^?.!\n]{8,140}\?)/g;
  const questions: Array<{ text: string; start: number; end: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = questionPattern.exec(sanitizedExcerpt)) !== null && questions.length < 30) {
    const question = (match[1] ?? "").trim();
    questions.push({
      text: question,
      start: match.index,
      end: match.index + question.length,
    });
  }

  for (let index = 0; index < questions.length && out.length < 20; index += 1) {
    const question = questions[index];
    const nextQuestion = questions[index + 1];
    const answerStart = question.end;
    const answerEnd = nextQuestion ? nextQuestion.start : Math.min(sanitizedExcerpt.length, answerStart + 420);
    const rawAnswer = sanitizedExcerpt.slice(answerStart, answerEnd).trim();

    const candidate = normalizeFaqCandidate(
      {
        question: question.text,
        answer: rawAnswer.slice(0, 420),
        sourceUrl: asNullableUrl(page.url),
      },
      {
        faqPageHint,
        minScore: faqPageHint ? 3 : 5,
      },
    );

    if (!candidate) continue;

    // Convert to conversational answer
    const conversationalAnswer = toConversationalAnswer(candidate.answer);
    if (!conversationalAnswer || conversationalAnswer.length < 15) continue;

    out.push({
      id: createId("faq"),
      question: candidate.question,
      answer: conversationalAnswer,
      sourceUrl: candidate.sourceUrl,
      include: candidate.score >= 6,
      confidence: Math.max(0, Math.min(1, candidate.score / 10)),
      lowConfidence: candidate.score < 6,
    });
  }

  return out;
}

/**
 * Main FAQ extraction: combines structured page extraction, policy detection, and question-mark fallback.
 * Scans ALL relevant page types, not just FAQ/general/contact.
 */
function extractFallbackFaqs(pages: CrawledPage[]) {
  const out: WebsiteImportDraft["faqs"] = [];
  const seenQuestions = new Set<string>();

  function addUnique(faqs: WebsiteImportDraft["faqs"]) {
    for (const faq of faqs) {
      const key = faq.question.toLowerCase();
      if (seenQuestions.has(key) || out.length >= 30) continue;
      // Check for near-duplicate questions (e.g., "Do you host private events?" vs "Do you host private events or weddings?")
      const isDuplicate = [...seenQuestions].some((existing) => {
        const shorter = existing.length < key.length ? existing : key;
        const longer = existing.length < key.length ? key : existing;
        return longer.includes(shorter.replace(/\?$/, ""));
      });
      if (isDuplicate) continue;
      seenQuestions.add(key);
      out.push(faq);
    }
  }

  for (const page of pages) {
    const pageType = (page as ClassifiedPage).pageType ?? "general";
    if (!FAQ_CONTENT_PAGES.has(pageType) && pageType !== "home" && pageType !== "menu" && pageType !== "events") continue;

    // 1. Structured heading-based extraction (e.g., FAQ pages with ## headings)
    addUnique(extractFaqsFromStructuredPage(page));

    // 2. Policy/topic detection from paragraph content
    addUnique(extractFaqsFromPolicyContent(page));

    // 3. Question-mark fallback for FAQ and general pages
    if (pageType === "faq" || pageType === "general" || pageType === "contact") {
      addUnique(extractQuestionMarkFaqs(page));
    }
  }

  return out.slice(0, 25);
}

function extractFallbackPolicies(pages: CrawledPage[]) {
  const policyHints = [
    { key: "privacy", title: "Privacy Policy" },
    { key: "terms", title: "Terms and Conditions" },
    { key: "return", title: "Returns Policy" },
    { key: "refund", title: "Refund Policy" },
    { key: "shipping", title: "Shipping Policy" },
    { key: "reservation", title: "Reservation Policy" },
    { key: "booking", title: "Booking Policy" },
    { key: "cancellation", title: "Cancellation Policy" },
  ];

  const out: WebsiteImportDraft["policies"] = [];

  for (const page of pages) {
    const haystack = `${page.url} ${page.title} ${page.textExcerpt}`.toLowerCase();
    const hint = policyHints.find((entry) => haystack.includes(entry.key));
    if (!hint) {
      continue;
    }

    if (out.some((entry) => entry.title === hint.title)) {
      continue;
    }

    const summary = page.textExcerpt.slice(0, 360).replace(/\s+/g, " ").trim();
    const sourceUrl = asNullableUrl(page.url);
    const score = scorePolicyCandidate(hint.title, summary, sourceUrl);
    if (score < 5) {
      continue;
    }

    out.push({
      id: createId("policy"),
      title: hint.title,
      summary,
      sourceUrl,
      include: true,
    });

    if (out.length >= 20) {
      break;
    }
  }

  return out;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUrl(value: unknown): string | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }
  try {
    const next = new URL(parsed);
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      return null;
    }
    return next.toString();
  } catch {
    return null;
  }
}

function sanitizeSourceUrl(value: unknown, allowedSources: Set<string>): string | null {
  const parsed = asUrl(value);
  if (!parsed) {
    return null;
  }
  return allowedSources.has(parsed) ? parsed : null;
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 4).length;
}

function normalizeSummary(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  const count = sentenceCount(compact);
  if (count >= 2 && count <= 4) {
    return compact;
  }

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .slice(0, 4);

  if (sentences.length < 2) {
    return null;
  }

  return sentences.join(" ");
}

function parseLlmJson(content: string): RawDraft | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === "object" && parsed !== null ? (parsed as RawDraft) : null;
  } catch {
    return null;
  }
}

function buildDeterministicDraft(sourceUrl: string, pages: CrawledPage[], signals: ImportSignals): WebsiteImportDraft {
  const classifiedPages = classifyPages(pages);
  const homepage = classifiedPages[0];
  const firstPhone = pickBestSignal(signals.phones, /contact|visit/);
  const firstEmail = pickBestSignal(signals.emails, /contact|visit/);
  const firstAddress = pickBestSignal(signals.addresses, /contact|visit|location/);
  const firstHours = pickBestSignal(signals.hours, /hours|visit|contact/);

  // Rank color candidates by brand signal. Near-duplicate hex variants are clustered
  // before scoring so rendering variance doesn't dilute brand signal.
  console.log(
    `[DEBUG:color-pre-rank] about to rank ${signals.colorCandidates.length} colorCandidates` +
    ` — sample: ${signals.colorCandidates.slice(0, 5).map((c) => `${c.value}(${c.context ?? "style"})`).join(", ")}`,
  );
  const rankedColors = rankBrandColorCandidates(signals.colorCandidates);
  // Skip cssvar-accent zone colors for primary: a variable named --accent/--cta
  // should be the accent, not the brand primary. Let it fall through to accent selection.
  console.log(
    `[DEBUG:color-post-rank] top 5 ranked: ${rankedColors.slice(0, 5).map((c) => `${c.value}(zone=${c.zone})`).join(", ") || "(none)"}`,
  );
  const primaryColor = rankedColors.find((c) => c.zone !== "cssvar-accent") ?? rankedColors[0];
  const accentColor = pickDistinctAccentColor(rankedColors, primaryColor?.value) ?? primaryColor;

  // Confidence correlates with which zone produced the winning color.
  // SVG (logo) and button (CTA) contexts are the strongest designer-intentional signals.
  const primaryZone = primaryColor?.zone ?? "style";
  const accentZone = accentColor?.zone ?? "style";
  const primaryConfidence = primaryColor
    ? (primaryZone === "cssvar-primary" ? 0.95 : ["svg", "button", "cssvar-accent", "cssvar-secondary"].includes(primaryZone) ? 0.88 : ["footer", "bg", "cssvar", "nav-bg"].includes(primaryZone) ? 0.75 : 0.62)
    : 0;
  const accentConfidence = accentColor
    ? (["cssvar-accent", "cssvar-primary"].includes(accentZone) ? 0.92 : accentZone === "button" ? 0.82 : 0.55)
    : 0;

  // Surface color: prefer an explicit CSS background-color value from the scan results
  // (light, low-saturation values only), then fall back to a warm-tint derivation.
  const scannedSurface = pickSurfaceColor(signals.colorCandidates);
  const backgroundColor = scannedSurface ?? (() => {
    const hex = primaryColor?.value;
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#FFFFFF";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return "#FFFFFF";
    const d = max - min;
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0)
      : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h / 6) * 360;
    // Warm = reds, oranges, golds, warm pinks, wines/magentas
    const isWarm = (h >= 0 && h <= 65) || h >= 310;
    if (!isWarm) return "#FFFFFF";
    const tr = Math.min(255, Math.round(r * 0.04 + 255 * 0.96));
    const tg = Math.min(255, Math.round(g * 0.04 + 255 * 0.96));
    const tb = Math.min(255, Math.round(b * 0.04 + 255 * 0.96));
    return `#${tr.toString(16).padStart(2, "0")}${tg.toString(16).padStart(2, "0")}${tb.toString(16).padStart(2, "0")}`.toUpperCase();
  })();

  // Muted text: secondary text color for labels/timestamps. Derived from background
  // luminance so it stays readable on both light and dark surfaces.
  const bgLumi = (() => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) return 0.96;
    const r = parseInt(backgroundColor.slice(1, 3), 16);
    const g = parseInt(backgroundColor.slice(3, 5), 16);
    const b = parseInt(backgroundColor.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  })();
  const mutedTextColor = bgLumi > 0.45 ? "#6B7280" : "#94A3B8";

  console.log(`[extract-draft] ── COLOR THEME SELECTION ──────────────────────────────────────`);
  console.log(`[extract-draft] scan url: ${sourceUrl}`);
  console.log(`[extract-draft] signals: ${signals.colorCandidates.length} colorCandidates → ranked: ${rankedColors.length} passed filters`);
  console.log(`[extract-draft] primary  = ${primaryColor?.value ?? "none"} (zone=${primaryZone}, confidence=${primaryConfidence.toFixed(2)})`);
  console.log(`[extract-draft] accent   = ${accentColor?.value ?? "none"} (zone=${accentZone}, confidence=${accentConfidence.toFixed(2)})`);
  console.log(`[extract-draft] surface  = ${backgroundColor}${scannedSurface ? " (scanned)" : " (derived from primary)"}`);
  console.log(`[extract-draft] text     = ${pickReadableTextColor(backgroundColor)} (from surface luminance)`);
  console.log(`[extract-draft] mutedText= ${mutedTextColor} (bgLumi=${bgLumi.toFixed(2)})`);
  console.log(`[extract-draft] ────────────────────────────────────────────────────────────────`);

  const logo = signals.logoCandidates[0] ?? signals.faviconCandidates[0];
  const font = signals.fontCandidates.find((entry) => !/serif|sans-serif|monospace/i.test(entry.value)) ?? signals.fontCandidates[0];
  const eventsResult = extractEventsFromPages(classifiedPages, signals);
  const events = eventsResult.events;
  const { eventPagesPresent, currentEventsFound } = eventsResult;
  const menuSections = extractMenuSectionsFromPages(classifiedPages);
  const reservations = extractReservationInfo(classifiedPages, signals);
  const memberships = extractMembershipInfo(classifiedPages);

  // Structured extraction summary — helps diagnose ingestion quality issues
  console.log(`[extract-draft] ── KNOWLEDGE EXTRACTION SUMMARY ─────────────────────────────`);
  console.log(`[extract-draft] pages: ${classifiedPages.length} total`);
  for (const p of classifiedPages) {
    console.log(`[extract-draft]   type=${p.pageType ?? "general"} url=${new URL(p.url).pathname} title="${p.title.slice(0, 60)}"`);
  }
  console.log(`[extract-draft] events: ${events.length} extracted eventPagesPresent=${eventPagesPresent} currentEventsFound=${currentEventsFound}`);
  for (const e of events) {
    console.log(`[extract-draft]   event "${e.title.slice(0, 60)}" date=${e.date ?? "none"} url=${e.sourceUrl ? new URL(e.sourceUrl).pathname : "null"}`);
  }
  console.log(`[extract-draft] menuSections: ${menuSections.length} extracted`);
  for (const s of menuSections) {
    console.log(`[extract-draft]   section "${s.title.slice(0, 50)}" cat=${s.semanticCategory} items=${s.items.length} url=${s.sourceUrl ? new URL(s.sourceUrl).pathname : "null"}`);
  }
  console.log(`[extract-draft] reservations: status=${reservations.status} platforms=${reservations.platforms.join(",") || "none"} bookingUrl=${reservations.bookingUrl ?? "none"}`);
  console.log(`[extract-draft] memberships: include=${memberships.include} name="${memberships.name}"`);
  console.log(`[extract-draft] ─────────────────────────────────────────────────────────────`);

  return {
    sourceUrl,
    pageClassification: classifiedPages.map((page) => ({
      url: page.url,
      title: page.title,
      pageType: page.pageType ?? "general",
    })),
    businessProfile: {
      name: {
        value: homepage?.title ?? null,
        sourceUrl: homepage?.url ?? null,
      },
      shortDescription: {
        value: homepage?.textExcerpt?.slice(0, 220) ?? null,
        sourceUrl: homepage?.url ?? null,
      },
      phone: {
        value: firstPhone?.value ?? null,
        sourceUrl: firstPhone?.sourceUrl ?? null,
      },
      email: {
        value: firstEmail?.value ?? null,
        sourceUrl: firstEmail?.sourceUrl ?? null,
      },
      address: {
        value: firstAddress?.value ?? null,
        sourceUrl: firstAddress?.sourceUrl ?? null,
      },
      hours: {
        value: firstHours?.value ?? null,
        sourceUrl: firstHours?.sourceUrl ?? null,
      },
      socialLinks: signals.socialLinks,
    },
    faqs: [],
    policies: [],
    restaurantKnowledge: {
      events,
      eventPagesPresent,
      currentEventsFound,
      menuSections,
      reservations,
      memberships,
    },
    brand: {
      primaryColor: {
        value: primaryColor?.value ?? null,
        sourceUrl: primaryColor?.sourceUrl ?? null,
        confidence: primaryConfidence,
      },
      accentColor: {
        value: accentColor?.value ?? null,
        sourceUrl: accentColor?.sourceUrl ?? null,
        confidence: accentConfidence,
      },
      backgroundColor: {
        value: backgroundColor,
        sourceUrl: homepage?.url ?? null,
        confidence: scannedSurface ? 0.60 : 0.30,
      },
      textColor: {
        value: pickReadableTextColor(backgroundColor),
        sourceUrl: homepage?.url ?? null,
        confidence: 0.40,
      },
      mutedTextColor: {
        value: mutedTextColor,
        sourceUrl: homepage?.url ?? null,
        confidence: 0.35,
      },
      fontFamily: {
        value: font?.value ?? null,
        sourceUrl: font?.sourceUrl ?? null,
        confidence: font ? 0.5 : 0,
      },
      logoUrl: {
        value: logo?.url ?? null,
        sourceUrl: logo?.sourceUrl ?? null,
        confidence: logo ? 0.7 : 0,
      },
    },
    restaurantInsights: {
      // Only populate eventHighlights when actual confirmed listings were extracted;
      // do not fall back to page snippets when event pages exist but have no listings.
      eventHighlights: currentEventsFound
        ? (events[0]?.description ?? bestPageSnippet(classifiedPages, /event|music|calendar|happenings|what'?s on/, 260))
        : null,
      // Only emit reservation guidance when booking is confirmed, not just page-exists.
      reservationGuidance: reservations.status === "confirmed"
        ? (reservations.instructions || bestPageSnippet(classifiedPages, /reserv|book|table|opentable|resy/, 260))
        : null,
      membershipNotes: memberships.benefits || bestPageSnippet(classifiedPages, /club|membership|wine club|loyalty/, 260),
      menuSummary: menuSections[0]?.items[0]?.description || bestPageSnippet(classifiedPages, /menu|dining|food|drink|tasting/, 260),
    },
    evidence: {
      pages: classifiedPages.map((page) => ({ url: page.url, title: page.title })),
    },
  };
}

function pickSource(value: string | null, fallbackSource: string | null, sourceFromLlm?: unknown): string | null {
  if (!value) {
    return null;
  }
  return asUrl(sourceFromLlm) ?? fallbackSource;
}

function parseLlmDraft(input: {
  sourceUrl: string;
  pages: CrawledPage[];
  signals: ImportSignals;
  llmDraft: RawDraft | null;
}): WebsiteImportDraft {
  const deterministic = buildDeterministicDraft(input.sourceUrl, input.pages, input.signals);
  const allowedSources = new Set(input.pages.map((page) => asUrl(page.url)).filter((url): url is string => Boolean(url)));
  if (!input.llmDraft) {
    console.log(
      `[extract-draft:final] stored brand (no-LLM path) → primary=${deterministic.brand.primaryColor.value ?? "none"}` +
      `(${(deterministic.brand.primaryColor.confidence ?? 0).toFixed(2)}) ` +
      `accent=${deterministic.brand.accentColor.value ?? "none"}` +
      `(${(deterministic.brand.accentColor.confidence ?? 0).toFixed(2)}) ` +
      `surface=${deterministic.brand.backgroundColor.value} ` +
      `text=${deterministic.brand.textColor.value}`,
    );
    return deterministic;
  }

  const llm = input.llmDraft;
  const brandObj = typeof llm.brand === "object" && llm.brand !== null ? (llm.brand as Record<string, unknown>) : {};

  const socialLinksFromLlm = Array.isArray(llm.social_links)
    ? llm.social_links
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const object = entry as Record<string, unknown>;
        const url = asUrl(object.url);
        if (!url) {
          return null;
        }
        const sourceUrl = asUrl(object.source_url) ?? input.sourceUrl;
        const platformCandidate = typeof object.platform === "string" ? object.platform.toLowerCase() : "other";
        const platform: "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "other" =
          platformCandidate === "facebook" ||
          platformCandidate === "instagram" ||
          platformCandidate === "tiktok" ||
          platformCandidate === "youtube" ||
          platformCandidate === "linkedin" ||
          platformCandidate === "x"
            ? platformCandidate
            : "other";
        return {
          platform,
          url,
          sourceUrl,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : deterministic.businessProfile.socialLinks;

  const faqs = Array.isArray(llm.faqs)
    ? llm.faqs
      .map((entry): RawFaq | null => (entry && typeof entry === "object" ? (entry as RawFaq) : null))
      .filter((entry): entry is RawFaq => Boolean(entry))
      .map((entry) => {
        const question = asString(entry.question);
        const answer = asString(entry.answer);
        const sourceUrl = sanitizeSourceUrl(entry.source_url, allowedSources);
        if (!question || !answer || !sourceUrl) {
          return null;
        }

        const candidate = normalizeFaqCandidate(
          {
            question,
            answer,
            sourceUrl,
          },
          {
            faqPageHint: isLikelyFaqPage(sourceUrl),
            minScore: 4,
          },
        );

        if (!candidate) {
          return null;
        }

        return {
          id: createId("faq"),
          question: candidate.question,
          answer: candidate.answer,
          sourceUrl: candidate.sourceUrl,
          include: candidate.score >= 6,
          confidence: Math.max(0, Math.min(1, candidate.score / 10)),
          lowConfidence: candidate.score < 6,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .filter((entry, index, list) =>
        list.findIndex((candidate) => candidate.question.toLowerCase() === entry.question.toLowerCase()) === index,
      )
      .slice(0, 20)
    : [];

  const policies = Array.isArray(llm.policies)
    ? llm.policies
      .map((entry): RawPolicy | null => (entry && typeof entry === "object" ? (entry as RawPolicy) : null))
      .filter((entry): entry is RawPolicy => Boolean(entry))
      .map((entry) => {
        const title = asString(entry.title);
        const summary = asString(entry.summary);
        const sourceUrl = sanitizeSourceUrl(entry.source_url, allowedSources);
        if (!title || !summary || !sourceUrl) {
          return null;
        }

        const score = scorePolicyCandidate(title, summary, sourceUrl);
        if (score < 6) {
          return null;
        }

        return {
          id: createId("policy"),
          title,
          summary,
          sourceUrl,
          include: true,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 20)
    : [];

  // Brand colors: deterministic ranking (rankBrandColorCandidates) is the canonical source of
  // truth. The LLM prompt receives all raw colorCandidates before filtering; it frequently picks
  // dark text/nav colors (e.g. #1e293b) that the deterministic ranker correctly rejects.
  // LLM font/logo overrides are kept because the ranker has no equivalent heuristics for those.
  console.log(
    `[extract-draft:final] stored brand → primary=${deterministic.brand.primaryColor.value ?? "none"}` +
    `(${(deterministic.brand.primaryColor.confidence ?? 0).toFixed(2)}) ` +
    `accent=${deterministic.brand.accentColor.value ?? "none"}` +
    `(${(deterministic.brand.accentColor.confidence ?? 0).toFixed(2)}) ` +
    `surface=${deterministic.brand.backgroundColor.value} ` +
    `text=${deterministic.brand.textColor.value}`,
  );

  const name = asString(llm.business_name);
  const shortDescription = normalizeSummary(asString(llm.short_description));
  const phone = asString(llm.phone);
  const email = asString(llm.email);
  const address = asString(llm.address);
  const hours = asString(llm.hours);
  const phoneSource = sanitizeSourceUrl(llm.phone_source_url, allowedSources);
  const emailSource = sanitizeSourceUrl(llm.email_source_url, allowedSources);
  const addressSource = sanitizeSourceUrl(llm.address_source_url, allowedSources);
  const hoursSource = sanitizeSourceUrl(llm.hours_source_url, allowedSources);
  const phoneFromLlm = phoneSource ? phone : null;
  const emailFromLlm = emailSource ? email : null;
  const addressFromLlm = addressSource ? address : null;
  const hoursFromLlm = hoursSource ? hours : null;

  return {
    sourceUrl: input.sourceUrl,
    pageClassification: deterministic.pageClassification,
    businessProfile: {
      name: {
        value: name ?? deterministic.businessProfile.name.value,
        sourceUrl: pickSource(name, deterministic.businessProfile.name.sourceUrl),
      },
      shortDescription: {
        value: shortDescription ?? normalizeSummary(deterministic.businessProfile.shortDescription.value) ?? deterministic.businessProfile.shortDescription.value,
        sourceUrl: pickSource(shortDescription, deterministic.businessProfile.shortDescription.sourceUrl),
      },
      phone: {
        value: phoneFromLlm ?? deterministic.businessProfile.phone.value,
        sourceUrl: pickSource(phoneFromLlm, deterministic.businessProfile.phone.sourceUrl, phoneSource),
      },
      email: {
        value: emailFromLlm ?? deterministic.businessProfile.email.value,
        sourceUrl: pickSource(emailFromLlm, deterministic.businessProfile.email.sourceUrl, emailSource),
      },
      address: {
        value: addressFromLlm ?? deterministic.businessProfile.address.value,
        sourceUrl: pickSource(addressFromLlm, deterministic.businessProfile.address.sourceUrl, addressSource),
      },
      hours: {
        value: hoursFromLlm ?? deterministic.businessProfile.hours.value,
        sourceUrl: pickSource(hoursFromLlm, deterministic.businessProfile.hours.sourceUrl, hoursSource),
      },
      socialLinks: socialLinksFromLlm,
    },
    faqs,
    policies,
    restaurantKnowledge: deterministic.restaurantKnowledge,
    brand: {
      // Colors come exclusively from the deterministic ranking path — see comment above.
      primaryColor: deterministic.brand.primaryColor,
      accentColor: deterministic.brand.accentColor,
      backgroundColor: deterministic.brand.backgroundColor,
      textColor: deterministic.brand.textColor,
      mutedTextColor: deterministic.brand.mutedTextColor,
      fontFamily: {
        value: asString(brandObj.font_family) ?? deterministic.brand.fontFamily.value,
        sourceUrl: pickSource(asString(brandObj.font_family), deterministic.brand.fontFamily.sourceUrl),
        confidence: typeof brandObj.font_confidence === "number" ? brandObj.font_confidence : deterministic.brand.fontFamily.confidence,
      },
      logoUrl: {
        value: asUrl(brandObj.logo_url) ?? deterministic.brand.logoUrl.value,
        sourceUrl: pickSource(asUrl(brandObj.logo_url), deterministic.brand.logoUrl.sourceUrl),
        confidence: typeof brandObj.logo_confidence === "number" ? brandObj.logo_confidence : deterministic.brand.logoUrl.confidence,
      },
    },
    restaurantInsights: {
      eventHighlights: asString(llm.event_highlights) ?? deterministic.restaurantInsights?.eventHighlights ?? null,
      reservationGuidance: asString(llm.reservation_guidance) ?? deterministic.restaurantInsights?.reservationGuidance ?? null,
      membershipNotes: asString(llm.membership_notes) ?? deterministic.restaurantInsights?.membershipNotes ?? null,
      menuSummary: asString(llm.menu_summary) ?? deterministic.restaurantInsights?.menuSummary ?? null,
    },
    evidence: {
      pages: input.pages.map((page) => ({ url: page.url, title: page.title })),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Per-page-type LLM extraction (focused prompts)                     */
/* ------------------------------------------------------------------ */

async function extractMenuWithLlm(pages: CrawledPage[]): Promise<ImportMenuSection[]> {
  const llmConfig = validateLLMServerConfig();
  if (!llmConfig.ok) return [];

  const menuPages = pages.filter((p) =>
    (p as ClassifiedPage).pageType === "menu" ||
    /\bmenu\b|\bfood\b|\bwine\s+list\b|\bcocktail\b|\bbrunch\b|\bdinner\b/i.test(`${p.url} ${p.title}`),
  );
  if (menuPages.length === 0) return [];

  // Use more generous text limit for menu pages (menus are long)
  const pagesPayload = menuPages.slice(0, 6).map((p) => ({
    url: p.url,
    title: p.title,
    text: p.textExcerpt.slice(0, 16_000),
  }));

  const instruction = [
    "You are a restaurant menu extractor. Given restaurant webpage text, extract a structured menu.",
    "Return ONLY valid JSON (no markdown fences).",
    "Schema: { \"sections\": [{ \"title\": string, \"source_url\": string, \"items\": [{ \"name\": string, \"price\": string|null, \"description\": string, \"dietary_notes\": string|null }] }] }",
    "Rules:",
    "- Each section represents a menu category (e.g., Appetizers, Entrees, Desserts, Beverages).",
    "- price should be a string like \"$12\" or \"$12.99\" or null if not listed.",
    "- description should be a brief description of the dish (ingredients, preparation). Empty string if none.",
    "- dietary_notes should note vegan, vegetarian, gluten-free, etc. if mentioned. Null otherwise.",
    "- Skip navigation text, page titles, footer content, and non-menu content.",
    "- If a page contains no menu items, return { \"sections\": [] }.",
    "- Limit to 12 sections and 25 items per section.",
  ].join("\n");

  try {
    const response = await llmGenerate({
      system: instruction,
      messages: [{ role: "user", content: JSON.stringify({ pages: pagesPayload }) }],
      temperature: 0,
      maxTokens: 4000,
    });

    const parsed = parseLlmJson(response.text ?? "");
    if (!parsed || !Array.isArray((parsed as Record<string, unknown>).sections)) return [];

    const rawSections = (parsed as Record<string, unknown>).sections as Array<Record<string, unknown>>;
    return rawSections
      .filter((s) => typeof s.title === "string" && Array.isArray(s.items))
      .slice(0, 12)
      .map((s) => ({
        id: createId("menu_section"),
        title: String(s.title).slice(0, 80),
        sourceUrl: asUrl(s.source_url) ?? menuPages[0]?.url ?? null,
        include: true,
        items: (s.items as Array<Record<string, unknown>>)
          .filter((item) => typeof item.name === "string" && String(item.name).length >= 2)
          .slice(0, 25)
          .map((item) => ({
            id: createId("menu_item"),
            name: String(item.name).slice(0, 80),
            price: typeof item.price === "string" ? item.price.slice(0, 12) : null,
            description: typeof item.description === "string" ? item.description.slice(0, 200) : "",
            dietaryNotes: typeof item.dietary_notes === "string" ? item.dietary_notes.slice(0, 100) : null,
            include: true,
          })),
      }))
      .filter((s) => s.items.length > 0);
  } catch {
    return [];
  }
}

async function extractFaqsWithLlm(pages: CrawledPage[]): Promise<ImportFaq[]> {
  const llmConfig = validateLLMServerConfig();
  if (!llmConfig.ok) return [];

  const faqPages = pages.filter((p) => {
    const pt = (p as ClassifiedPage).pageType;
    return pt === "faq" || pt === "policies" || pt === "about" || pt === "contact" || pt === "general";
  });
  if (faqPages.length === 0) return [];

  const pagesPayload = faqPages.slice(0, 8).map((p) => ({
    url: p.url,
    title: p.title,
    pageType: (p as ClassifiedPage).pageType,
    text: p.textExcerpt.slice(0, 10_000),
  }));

  const instruction = [
    "You are a FAQ extractor for a restaurant or business website.",
    "Extract question-and-answer pairs from the provided page text.",
    "Return ONLY valid JSON (no markdown fences).",
    "Schema: { \"faqs\": [{ \"question\": string, \"answer\": string, \"source_url\": string }] }",
    "Rules:",
    "- Questions should be natural customer questions (e.g., 'Do you allow dogs?', 'What are your hours?').",
    "- Answers should be 1-3 sentences, conversational tone, as if a chatbot is responding to a guest.",
    "- Only include FAQs supported by explicit evidence on the page. Do not invent answers.",
    "- source_url must be one of the provided page URLs.",
    "- Skip navigation, footer, social media, and cookie/privacy boilerplate.",
    "- Look for: policies, hours, parking, reservations, dress code, dietary accommodations, private events, cancellation, pet policy, etc.",
    "- Limit to 20 FAQs total, prioritizing the most useful for customers.",
  ].join("\n");

  try {
    const response = await llmGenerate({
      system: instruction,
      messages: [{ role: "user", content: JSON.stringify({ pages: pagesPayload }) }],
      temperature: 0,
      maxTokens: 3000,
    });

    const parsed = parseLlmJson(response.text ?? "");
    if (!parsed || !Array.isArray((parsed as Record<string, unknown>).faqs)) return [];

    const allowedUrls = new Set(pages.map((p) => p.url));
    return ((parsed as Record<string, unknown>).faqs as Array<Record<string, unknown>>)
      .filter((f) => typeof f.question === "string" && typeof f.answer === "string" && typeof f.source_url === "string")
      .filter((f) => allowedUrls.has(String(f.source_url)))
      .slice(0, 20)
      .map((f) => ({
        id: createId("faq"),
        question: String(f.question).slice(0, 150),
        answer: String(f.answer).slice(0, 350),
        sourceUrl: String(f.source_url),
        include: true,
        confidence: 0.85,
        lowConfidence: false,
      }));
  } catch {
    return [];
  }
}

async function extractContactWithLlm(pages: CrawledPage[]): Promise<{
  name: string | null;
  shortDescription: string | null;
  phone: string | null;
  phoneSourceUrl: string | null;
  email: string | null;
  emailSourceUrl: string | null;
  address: string | null;
  addressSourceUrl: string | null;
  hours: string | null;
  hoursSourceUrl: string | null;
} | null> {
  const llmConfig = validateLLMServerConfig();
  if (!llmConfig.ok) return null;

  const contactPages = pages.filter((p) => {
    const pt = (p as ClassifiedPage).pageType;
    return pt === "contact" || pt === "hours" || pt === "home" || pt === "about";
  });
  if (contactPages.length === 0) return null;

  const pagesPayload = contactPages.slice(0, 5).map((p) => ({
    url: p.url,
    title: p.title,
    pageType: (p as ClassifiedPage).pageType,
    text: p.textExcerpt.slice(0, 6000),
  }));

  const instruction = [
    "Extract business contact information from the provided restaurant/business website pages.",
    "Return ONLY valid JSON (no markdown fences).",
    "Schema: { \"name\": string|null, \"short_description\": string|null, \"phone\": string|null, \"phone_source_url\": string|null, \"email\": string|null, \"email_source_url\": string|null, \"address\": string|null, \"address_source_url\": string|null, \"hours\": string|null, \"hours_source_url\": string|null }",
    "Rules:",
    "- name: the business name, not a page title.",
    "- short_description: 2-3 sentence description of the business based on evidence.",
    "- All source_url fields must be one of the provided page URLs.",
    "- hours should be a compact summary like 'Mon-Fri 11am-9pm, Sat-Sun 10am-10pm'.",
    "- Set fields to null if not found in the text. Do not guess.",
  ].join("\n");

  try {
    const response = await llmGenerate({
      system: instruction,
      messages: [{ role: "user", content: JSON.stringify({ pages: pagesPayload }) }],
      temperature: 0,
      maxTokens: 800,
    });

    const parsed = parseLlmJson(response.text ?? "");
    if (!parsed) return null;

    const raw = parsed as Record<string, unknown>;
    const allowedUrls = new Set(pages.map((p) => p.url));
    const validSource = (v: unknown) => typeof v === "string" && allowedUrls.has(v) ? v : null;

    return {
      name: asString(raw.name),
      shortDescription: asString(raw.short_description),
      phone: asString(raw.phone),
      phoneSourceUrl: validSource(raw.phone_source_url),
      email: asString(raw.email),
      emailSourceUrl: validSource(raw.email_source_url),
      address: asString(raw.address),
      addressSourceUrl: validSource(raw.address_source_url),
      hours: asString(raw.hours),
      hoursSourceUrl: validSource(raw.hours_source_url),
    };
  } catch {
    return null;
  }
}

async function extractWithLlm(args: { sourceUrl: string; pages: CrawledPage[]; signals: ImportSignals }): Promise<RawDraft | null> {
  const llmConfig = validateLLMServerConfig();
  if (!llmConfig.ok) {
    return null;
  }

  const compactPages = args.pages.map((page) => ({
    url: page.url,
    title: page.title,
    text: page.textExcerpt.slice(0, 8000),
  }));

  const instruction = [
    "Extract structured business onboarding data from website crawl pages.",
    "Return ONLY valid JSON. No markdown fences.",
    "Hard rule: if a field is not supported by explicit evidence from provided pages/signals, set it to null or empty array.",
    "For phone/email/address/hours, include source URLs using phone_source_url/email_source_url/address_source_url/hours_source_url and only use URLs from provided pages.",
    "short_description must be 2-4 sentences, concrete, and based only on provided evidence.",
    "Every FAQ and policy entry must include a source_url from provided pages; otherwise omit the entry.",
    "Prefer concise summaries and avoid speculation.",
    "Schema:",
    "{",
    '  "business_name": string|null,',
    '  "short_description": string|null,',
    '  "phone": string|null,',
    '  "phone_source_url": string|null,',
    '  "email": string|null,',
    '  "email_source_url": string|null,',
    '  "address": string|null,',
    '  "address_source_url": string|null,',
    '  "hours": string|null,',
    '  "hours_source_url": string|null,',
    '  "social_links": [{"platform": string, "url": string, "source_url": string}],',
    '  "faqs": [{"question": string, "answer": string, "source_url": string}],',
    '  "policies": [{"title": string, "summary": string, "source_url": string}],',
    '  "event_highlights": string|null,',
    '  "reservation_guidance": string|null,',
    '  "membership_notes": string|null,',
    '  "menu_summary": string|null,',
    '  "brand": {',
    '    "primary_color": string|null,',
    '    "accent_color": string|null,',
    '    "background_color": string|null,',
    '    "text_color": string|null,',
    '    "font_family": string|null,',
    '    "logo_url": string|null,',
    '    "primary_confidence": number,',
    '    "accent_confidence": number,',
    '    "background_confidence": number,',
    '    "text_confidence": number,',
    '    "font_confidence": number,',
    '    "logo_confidence": number',
    "  }",
    "}",
  ].join("\n");

  const response = await llmGenerate({
    system: instruction,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          sourceUrl: args.sourceUrl,
          deterministicSignals: args.signals,
          pages: compactPages,
        }),
      },
    ],
    temperature: 0,
    maxTokens: 2600,
  });

  return parseLlmJson(response.text ?? "");
}

export async function buildWebsiteImportResult(input: {
  sourceUrl: string;
  pages: CrawledPage[];
  signals: ImportSignals;
  crawlReport?: import("./types").CrawlReport;
}): Promise<WebsiteImportResult> {
  const classifiedPages = classifyPages(input.pages);

  // Run all LLM extractors in parallel: monolithic + per-page-type focused extractors
  const [llmDraft, llmMenuSections, llmFaqs, llmContact] = await Promise.all([
    extractWithLlm({ ...input, pages: classifiedPages }).catch(() => null),
    extractMenuWithLlm(classifiedPages).catch(() => []),
    extractFaqsWithLlm(classifiedPages).catch(() => []),
    extractContactWithLlm(classifiedPages).catch(() => null),
  ]);

  const draft = parseLlmDraft({
    sourceUrl: input.sourceUrl,
    pages: classifiedPages,
    signals: input.signals,
    llmDraft,
  });

  // Prefer per-page-type LLM menu results over heuristic extraction when available
  if (llmMenuSections.length > 0) {
    draft.restaurantKnowledge.menuSections = llmMenuSections;
  }

  // Prefer per-page-type LLM FAQs over monolithic LLM FAQs when available
  if (llmFaqs.length > 0) {
    draft.faqs = llmFaqs;
  }

  // Merge per-page-type LLM contact info: fill in gaps not covered by monolithic extraction
  if (llmContact) {
    const bp = draft.businessProfile;
    if (!bp.name.value && llmContact.name) {
      bp.name = { value: llmContact.name, sourceUrl: llmContact.phoneSourceUrl ?? input.sourceUrl };
    }
    if (!bp.shortDescription.value && llmContact.shortDescription) {
      bp.shortDescription = { value: llmContact.shortDescription, sourceUrl: input.sourceUrl };
    }
    if (!bp.phone.value && llmContact.phone) {
      bp.phone = { value: llmContact.phone, sourceUrl: llmContact.phoneSourceUrl };
    }
    if (!bp.email.value && llmContact.email) {
      bp.email = { value: llmContact.email, sourceUrl: llmContact.emailSourceUrl };
    }
    if (!bp.address.value && llmContact.address) {
      bp.address = { value: llmContact.address, sourceUrl: llmContact.addressSourceUrl };
    }
    if (!bp.hours.value && llmContact.hours) {
      bp.hours = { value: llmContact.hours, sourceUrl: llmContact.hoursSourceUrl };
    }
  }

  if (draft.faqs.length === 0) {
    draft.faqs = extractFallbackFaqs(classifiedPages);
  }

  // Generate FAQ suggestions from structured knowledge (events, reservations, menus, memberships)
  const knowledgeFaqs = generateFaqsFromKnowledge(draft);
  if (knowledgeFaqs.length > 0) {
    const existingQuestions = new Set(draft.faqs.map((f) => f.question.toLowerCase()));
    for (const faq of knowledgeFaqs) {
      const key = faq.question.toLowerCase();
      if (existingQuestions.has(key)) continue;
      // Near-duplicate check: skip if an existing question contains this one (or vice versa)
      const isDuplicate = [...existingQuestions].some((existing) => {
        const shorter = existing.length < key.length ? existing : key;
        const longer = existing.length < key.length ? key : existing;
        return longer.includes(shorter.replace(/\?$/, ""));
      });
      if (isDuplicate) continue;
      draft.faqs.push(faq);
      existingQuestions.add(key);
    }
  }

  if (draft.policies.length === 0) {
    draft.policies = extractFallbackPolicies(classifiedPages);
  }

  return {
    pages: classifiedPages,
    signals: input.signals,
    draft,
    crawlReport: input.crawlReport,
  };
}

function generateFaqsFromKnowledge(draft: WebsiteImportDraft): WebsiteImportDraft["faqs"] {
  const faqs: WebsiteImportDraft["faqs"] = [];

  // Reservation FAQ: only when booking is confirmed (has platform URL or actionable instructions)
  const reservations = draft.restaurantKnowledge.reservations;
  if (reservations.status === "confirmed" && (reservations.bookingUrl || reservations.instructions)) {
    const parts: string[] = [];
    if (reservations.platforms.length) {
      parts.push(`Reservations are available through ${reservations.platforms.join(" and ")}.`);
    } else {
      parts.push("Yes, we recommend making a reservation.");
    }
    if (reservations.bookingUrl) {
      parts.push(`You can book online at ${reservations.bookingUrl}.`);
    }

    faqs.push({
      id: createId("faq"),
      question: "Do I need a reservation?",
      answer: parts.join(" ").slice(0, 280),
      sourceUrl: reservations.sourceUrl,
      include: true,
      confidence: 0.9,
    });

    if (reservations.depositPolicy) {
      // Guard: skip if extracted text doesn't look like an actual deposit/cancellation policy
      const isQualityPolicy =
        /deposit|\$\d+|cancell?ation|refund|fee/i.test(reservations.depositPolicy) &&
        !/skip\s+to|load\s+more|opens?\s+in\s+a\s+new/i.test(reservations.depositPolicy);
      if (isQualityPolicy) {
      const answer = toConversationalAnswer(reservations.depositPolicy);
      if (answer) {
        faqs.push({
          id: createId("faq"),
          question: "What is your cancellation or deposit policy?",
          answer,
          sourceUrl: reservations.sourceUrl,
          include: true,
          confidence: 0.8,
        });
      }
      }
    }

    if (reservations.partySizeNotes) {
      // Guard: skip if extracted text doesn't look like actual party size guidance
      const isQualityNote =
        /party|group|guest|seat|reserv|table/i.test(reservations.partySizeNotes) &&
        !/skip\s+to|load\s+more|opens?\s+in\s+a\s+new/i.test(reservations.partySizeNotes);
      if (isQualityNote) {
      const answer = validateFaqAnswer(toConversationalAnswer(reservations.partySizeNotes));
      if (answer) {
        faqs.push({
          id: createId("faq"),
          question: "Can you accommodate large groups?",
          answer,
          sourceUrl: reservations.sourceUrl,
          include: true,
          confidence: 0.8,
        });
      }
      }
    }
  }

  // Events FAQ: only when concrete dated listings were found
  const events = draft.restaurantKnowledge.events.filter((e) => e.include);
  const currentEventsFound = draft.restaurantKnowledge.currentEventsFound ?? (events.length > 0);
  if (currentEventsFound && events.length > 0) {
    const upcoming = events.slice(0, 3);
    const eventList = upcoming.map((e) => `${e.title}${e.date ? ` (${e.date})` : ""}`).join(", ");
    faqs.push({
      id: createId("faq"),
      question: "What events do you have coming up?",
      answer: `We have some great events coming up! ${eventList}.${events.length > 3 ? ` Plus ${events.length - 3} more — check our events page for the full list.` : ""}`,
      sourceUrl: events[0].sourceUrl,
      include: true,
      confidence: 0.85,
    });

    const liveMusic = events.filter((e) => /music|live|dj|piano|jazz|band/i.test(`${e.title} ${e.category}`));
    if (liveMusic.length > 0) {
      faqs.push({
        id: createId("faq"),
        question: "Do you have live music?",
        answer: `Yes, we have live music! ${liveMusic.slice(0, 2).map((e) => `${e.title}${e.date ? ` on ${e.date}` : ""}`).join(" and ")}. Check our events page for the full schedule.`,
        sourceUrl: liveMusic[0].sourceUrl,
        include: true,
        confidence: 0.85,
      });
    }
  }

  // Private events FAQ
  const privateEvents = draft.pageClassification.find((p) => p.pageType === "private-events");
  if (privateEvents) {
    faqs.push({
      id: createId("faq"),
      question: "Do you host private events or weddings?",
      answer: "Yes, we host private events and weddings! Contact us for availability and details about our event spaces.",
      sourceUrl: privateEvents.url,
      include: true,
      confidence: 0.8,
    });
  }

  // Membership / Wine Club FAQ
  const memberships = draft.restaurantKnowledge.memberships;
  if (memberships.include && memberships.benefits) {
    // Clean benefits text: strip page title, "Skip to content", repeated headings, pipe patterns
    const cleanedBenefits = memberships.benefits
      .replace(/^[^.]*\|\s*[^|.]*(?:\|[^|.]*)*\s*/i, "")
      .replace(/[^\n.!?]*\|[^\n.!?]*/g, " ")
      .replace(/skip\s+to\s+content/gi, "")
      .replace(/^(?:wine\s+club|membership)\s+(?:wine\s+club|membership)\s+/gi, "")
      // Remove repeated consecutive phrases (e.g., "Wine Club Wine Club Wine Club")
      .replace(/\b(\w+(?:\s+\w+)?)\s+(?:\1\s+)+/gi, "$1 ")
      .replace(/\s+/g, " ")
      .trim();
    const answer = validateFaqAnswer(toConversationalAnswer(cleanedBenefits));
    // Clean the membership name — strip location/business suffixes from page titles
    const rawName = (memberships.name ?? "").replace(/\s*[|–—]\s*.*/g, "").replace(/\s+in\s+.*/i, "").trim();
    const hasCleanName = rawName.length >= 3 && rawName.length <= 40 && !/membership/i.test(rawName);
    faqs.push({
      id: createId("faq"),
      question: hasCleanName ? `What is the ${rawName}?` : "Do you have a wine club or membership?",
      answer: answer || "Yes, we have a membership program. Contact us for details.",
      sourceUrl: memberships.sourceUrl,
      include: true,
      confidence: 0.85,
    });
  }

  // Hours FAQ
  if (draft.businessProfile.hours.value) {
    // Clean hours text: strip phone numbers that may have leaked in
    const cleanHours = draft.businessProfile.hours.value
      .replace(/\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, "")
      .replace(/\d{3}[-.]?\d{3}[-.]?\d{4}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanHours.length >= 5) {
      faqs.push({
        id: createId("faq"),
        question: "What are your hours?",
        answer: `Our hours are: ${cleanHours}.`,
        sourceUrl: draft.businessProfile.hours.sourceUrl,
        include: true,
        confidence: 0.9,
      });
    }
  }

  // Location / Contact FAQ
  if (draft.businessProfile.address.value) {
    // Clean the address value — strip event/page noise that may have leaked from regex
    const cleanAddress = draft.businessProfile.address.value
      .replace(/\s+/g, " ")
      // Truncate after zip code pattern (e.g., "Berlin, MD 21811")
      .replace(/(\b[A-Z]{2}\s+\d{5}(?:-\d{4})?)\b.*$/, "$1")
      // Strip event/content noise that leaked in
      .replace(/\b(?:Club|Events?|Wine|Farm|Kitchen|Pick-Up|Party|Join|Winery|Vineyard)\b[^,.]*/gi, "")
      .replace(/\b\d{4}\s+(?:wine|farm|event|club)/gi, "")
      .trim()
      .slice(0, 120);

    if (cleanAddress.length >= 10 && !/\b(event|party|join|club)\b/i.test(cleanAddress)) {
      const parts = [`We're located at ${cleanAddress}.`];
      if (draft.businessProfile.phone.value) {
        const cleanPhone = draft.businessProfile.phone.value.replace(/[^0-9+() -]/g, "").trim();
        if (cleanPhone.length >= 7) {
          parts.push(`You can reach us at ${cleanPhone}.`);
        }
      }

      faqs.push({
        id: createId("faq"),
        question: "Where are you located?",
        answer: parts.join(" "),
        sourceUrl: draft.businessProfile.address.sourceUrl,
        include: true,
        confidence: 0.9,
      });
    }
  }

  // Menu highlights FAQ
  const menuSections = draft.restaurantKnowledge.menuSections.filter((m) => m.include);
  if (menuSections.length > 0) {
    // Clean section names — strip full page titles, location text, only keep actual section names
    const MONTH_REGEX = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;
    const sectionNames = [...new Set(menuSections
      .map((s) => s.title
        .replace(/\s*[|–—]\s*.*/g, "")
        .replace(/\s+in\s+.*/i, "")
        .replace(/\b(?:Berlin|MD|Windmill|Creek|Winery|Kitchen)\b/gi, "")
        // Strip "Farm" only as a standalone word, not in "Farm-to-Table"
        .replace(/\bFarm\b(?!-)/gi, "")
        .replace(/&#\d+;/g, " ")
        .replace(/&\w+;/g, " ")
        .replace(/\s+/g, " ")
        .trim())
      .filter((s) => s.length >= 3 && s.length <= 40)
      // Reject month/season headings (e.g., "November Through March")
      .filter((s) => !MONTH_REGEX.test(s))
      // Reject page titles and navigation
      .filter((s) => !/\b(dining|reservations?|igloo|menus?)\s*&\s*/i.test(s) || s.length <= 20)
      .filter((s) => !/^(menu|dining|food|restaurant)\s*$/i.test(s))
      // Reject section names starting with punctuation (e.g., "-to-Table")
      .filter((s) => /^[A-Za-z]/.test(s))
      // Reject event titles (contain colons, e.g., "Four Hands Dinner: Chef...")
      .filter((s) => !/:/.test(s))
      // Reject generic seasonal labels
      .filter((s) => !/\b(through|thru|until|season|winter|spring|summer|fall|autumn)\b/i.test(s))
      // Reject page/event titles that aren't actual food categories
      .filter((s) => !/\b(restaurant|dinner|village|brunch|experience|event)\b/i.test(s) || /\b(appetizer|entree|dessert|salad|soup|sandwich|pizza|pasta|seafood|steak|chicken|cocktail|beer|wine list)\b/i.test(s))
    )].slice(0, 4);
    if (sectionNames.length > 0) {
      faqs.push({
        id: createId("faq"),
        question: "What kind of food do you serve?",
        answer: `Our menu features ${sectionNames.join(", ")}. Check our menu page for the full selection and current offerings.`,
        sourceUrl: menuSections[0].sourceUrl,
        include: true,
        confidence: 0.75,
      });
    } else {
      // No clean menu section names found — skip generating a misleading FAQ.
      // The food/menu topic may still be captured by extractFaqsFromPolicyContent.
    }
  }

  return faqs;
}

/**
 * Extract menu sections from raw text or a fetched page using LLM.
 * Used by the manual menu import endpoint.
 */
export async function extractMenuFromText(text: string, sourceUrl: string | null): Promise<ImportMenuSection[]> {
  const page: CrawledPage = {
    url: sourceUrl ?? "manual-input",
    title: "Menu",
    textExcerpt: text.slice(0, 24_000),
    pageType: "menu",
  };
  const llmResult = await extractMenuWithLlm([page]);
  if (llmResult.length > 0) return llmResult;

  // Fallback to heuristic extraction
  return extractMenuSectionsFromPages([page]);
}
