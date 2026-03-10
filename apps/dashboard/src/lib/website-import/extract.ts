import { llmGenerate, validateLLMServerConfig } from "@tandem/shared/server";
import type {
  CrawledPage,
  ImportEvent,
  ImportMembershipInfo,
  ImportMenuItem,
  ImportMenuSection,
  ImportReservationInfo,
  ImportSignals,
  WebsiteImportDraft,
  WebsiteImportResult,
  WebsitePageType,
} from "./types";
import { isLikelyFaqPage, normalizeFaqCandidate } from "./faq-heuristics";
import { createId, normalizeHexColor, pickReadableTextColor } from "./utils";

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

function classifyPageType(page: CrawledPage): WebsitePageType {
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

function hasStrongEventSignal(page: CrawledPage): boolean {
  const haystack = `${page.url} ${page.title} ${page.textExcerpt}`.toLowerCase();
  return /\/event\//.test(page.url)
    || /event\s+series|all\s+events|upcoming\s+events|calendar/.test(haystack)
    || /\b(march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b\s+\d{1,2}/.test(haystack);
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

function extractEventsFromPages(pages: CrawledPage[], signals: ImportSignals): ImportEvent[] {
  const events: ImportEvent[] = [];
  const seen = new Set<string>();
  const eventPages = pages.filter((page) => page.pageType === "events" || hasStrongEventSignal(page));
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

  return events
    .filter((entry) => entry.title.length >= 4)
    .slice(0, 20);
}

function extractMenuSectionsFromPages(pages: CrawledPage[]): ImportMenuSection[] {
  const menuPages = pages.filter((page) => page.pageType === "menu" || /menu|food|wine|cocktail|brunch|dinner/i.test(`${page.url} ${page.title}`));
  const sections: ImportMenuSection[] = [];

  for (const page of menuPages) {
    const text = compact(page.textExcerpt);
    const structuredText = page.structuredText ?? "";

    // Try heading-based structured parsing first (## Section / - Item lines)
    const structuredSections = parseStructuredMenuText(structuredText, page);
    if (structuredSections.length > 0) {
      sections.push(...structuredSections);
      continue;
    }

    // Try price-pattern parsing
    const priceSections = parsePricePatternMenu(text, page);
    if (priceSections.length > 0) {
      sections.push(...priceSections);
      continue;
    }

    // Try text-block heuristic parsing (for plain text menus without prices)
    const heuristicSections = parseTextBlockMenu(text, page);
    if (heuristicSections.length > 0) {
      sections.push(...heuristicSections);
      continue;
    }

    // Final fallback: single overview section
    sections.push({
      id: createId("menu_section"),
      title: page.title || "Menu",
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

  return sections.slice(0, 12);
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
    name: compact((match[1] ?? "Item").replace(/[^a-zA-Z0-9&,'\-\s]/g, "")).slice(-48) || "Menu item",
    price: `$${match[2]}`,
    description: "",
    dietaryNotes: hasDietaryNotes ? "Contains dietary notes on page" : null,
    include: true,
  }));

  return [{
    id: createId("menu_section"),
    title: sectionTitle,
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
    && !/skip|menu|navigation|search|cart|home|back/i.test(h)
    && !/^\d+$/.test(h),
  );

  if (menuHeadings.length < 2) return [];

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
      sourceUrl: page.url,
      include: true,
      items,
    });
  }

  return sections;
}

function extractReservationInfo(pages: CrawledPage[], signals: ImportSignals): ImportReservationInfo {
  const reservationPages = pages.filter(
    (page) => page.pageType === "reservations" || page.pageType === "private-events" || /reserv|book|table|opentable|resy|tock|experience/i.test(`${page.url} ${page.title} ${page.textExcerpt.slice(0, 280)}`),
  );
  const bookingSignal = signals.bookingLinks[0] ?? null;

  if (!reservationPages.length && !bookingSignal) {
    return {
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

  const joined = compact(reservationPages.map((entry) => `${entry.title}. ${entry.textExcerpt}`).join(" "));
  const bookingUrl =
    bookingSignal?.url
    ?? reservationPages.find((entry) => /resy|opentable|tock|book|reserv|sevenrooms|toast/i.test(`${entry.url} ${entry.textExcerpt}`))?.url
    ?? reservationPages[0]?.url
    ?? null;
  const platforms = ["resy", "opentable", "tock", "sevenrooms", "toast"].filter((platform) => new RegExp(platform, "i").test(`${joined} ${bookingUrl}`));

  return {
    include: true,
    sourceUrl: reservationPages[0]?.url ?? bookingSignal?.sourceUrl ?? null,
    bookingUrl,
    platforms,
    instructions: (joined || bookingSignal?.label || "").slice(0, 360),
    partySizeNotes: joined.match(/party[^.]{0,100}|group[^.]{0,100}/i)?.[0] ?? null,
    depositPolicy: joined.match(/deposit[^.]{0,120}|cancellation[^.]{0,120}/i)?.[0] ?? null,
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

function extractFallbackFaqs(pages: CrawledPage[]) {
  const out: WebsiteImportDraft["faqs"] = [];
  const seenQuestions = new Set<string>();
  const questionPattern = /([^?.!\n]{8,140}\?)/g;

  const sanitizeFallbackText = (value: string) => value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\/[a-z0-9\-_]+\?(?:[^\s]{6,})/gi, " ")
    .replace(/\bshare\s+on\b/gi, " ")
    .replace(/\bsee\s+more\b/gi, " ")
    .replace(/\bcomments?\b/gi, " ")
    .replace(/\blikes?\b/gi, " ")
    .replace(/\bcopy\s+link\b/gi, " ")
    .replace(/\bretweet\b/gi, " ")
    .replace(/\bpinterest\b/gi, " ")
    .replace(/(?:skip\s+to\s+content|main\s+menu|privacy\s+policy|terms)\b[^?.!\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const page of pages) {
    if (page.pageType && page.pageType !== "faq" && page.pageType !== "general" && page.pageType !== "contact") {
      continue;
    }

    const faqPageHint = isLikelyFaqPage(page.url, page.title);
    const sanitizedExcerpt = sanitizeFallbackText(page.textExcerpt);
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
      const answer = sanitizedExcerpt.slice(answerStart, answerEnd).trim();

      const candidate = normalizeFaqCandidate(
        {
          question: question.text,
          answer: answer.slice(0, 420),
          sourceUrl: asNullableUrl(page.url),
        },
        {
          faqPageHint,
          minScore: faqPageHint ? 3 : 5,
        },
      );

      if (!candidate) {
        continue;
      }

      const key = candidate.question.toLowerCase();
      if (seenQuestions.has(key)) {
        continue;
      }
      seenQuestions.add(key);

      out.push({
        id: createId("faq"),
        question: candidate.question,
        answer: candidate.answer,
        sourceUrl: candidate.sourceUrl,
        include: candidate.score >= 6,
        confidence: Math.max(0, Math.min(1, candidate.score / 10)),
        lowConfidence: candidate.score < 6,
      });
    }

    if (out.length >= 20) {
      break;
    }
  }

  return out;
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
  const primaryColor = signals.colorCandidates[0];
  const accentColor = signals.colorCandidates[1] ?? primaryColor;
  const backgroundColor = normalizeHexColor("#FFFFFF");
  const logo = signals.logoCandidates[0] ?? signals.faviconCandidates[0];
  const font = signals.fontCandidates.find((entry) => !/serif|sans-serif|monospace/i.test(entry.value)) ?? signals.fontCandidates[0];
  const events = extractEventsFromPages(classifiedPages, signals);
  const menuSections = extractMenuSectionsFromPages(classifiedPages);
  const reservations = extractReservationInfo(classifiedPages, signals);
  const memberships = extractMembershipInfo(classifiedPages);

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
      menuSections,
      reservations,
      memberships,
    },
    brand: {
      primaryColor: {
        value: primaryColor?.value ?? null,
        sourceUrl: primaryColor?.sourceUrl ?? null,
        confidence: primaryColor ? 0.65 : 0,
      },
      accentColor: {
        value: accentColor?.value ?? null,
        sourceUrl: accentColor?.sourceUrl ?? null,
        confidence: accentColor ? 0.55 : 0,
      },
      backgroundColor: {
        value: backgroundColor,
        sourceUrl: homepage?.url ?? null,
        confidence: 0.3,
      },
      textColor: {
        value: pickReadableTextColor(backgroundColor),
        sourceUrl: homepage?.url ?? null,
        confidence: 0.3,
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
      eventHighlights: events[0]?.description ?? bestPageSnippet(classifiedPages, /event|music|calendar|happenings|what'?s on/, 260),
      reservationGuidance: reservations.instructions || bestPageSnippet(classifiedPages, /reserv|book|table|opentable|resy/, 260),
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

  const primaryColor = normalizeHexColor(asString(brandObj.primary_color));
  const accentColor = normalizeHexColor(asString(brandObj.accent_color));
  const backgroundColor = normalizeHexColor(asString(brandObj.background_color)) ?? deterministic.brand.backgroundColor.value;
  const textColor = normalizeHexColor(asString(brandObj.text_color)) ?? pickReadableTextColor(backgroundColor);

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
      primaryColor: {
        value: primaryColor ?? deterministic.brand.primaryColor.value,
        sourceUrl: pickSource(primaryColor, deterministic.brand.primaryColor.sourceUrl),
        confidence: typeof brandObj.primary_confidence === "number" ? brandObj.primary_confidence : deterministic.brand.primaryColor.confidence,
      },
      accentColor: {
        value: accentColor ?? deterministic.brand.accentColor.value,
        sourceUrl: pickSource(accentColor, deterministic.brand.accentColor.sourceUrl),
        confidence: typeof brandObj.accent_confidence === "number" ? brandObj.accent_confidence : deterministic.brand.accentColor.confidence,
      },
      backgroundColor: {
        value: backgroundColor,
        sourceUrl: pickSource(backgroundColor, deterministic.brand.backgroundColor.sourceUrl),
        confidence: typeof brandObj.background_confidence === "number" ? brandObj.background_confidence : deterministic.brand.backgroundColor.confidence,
      },
      textColor: {
        value: textColor,
        sourceUrl: pickSource(textColor, deterministic.brand.textColor.sourceUrl),
        confidence: typeof brandObj.text_confidence === "number" ? brandObj.text_confidence : deterministic.brand.textColor.confidence,
      },
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
}): Promise<WebsiteImportResult> {
  const classifiedPages = classifyPages(input.pages);
  const llmDraft = await extractWithLlm({ ...input, pages: classifiedPages }).catch(() => null);
  const draft = parseLlmDraft({
    sourceUrl: input.sourceUrl,
    pages: classifiedPages,
    signals: input.signals,
    llmDraft,
  });

  if (draft.faqs.length === 0) {
    draft.faqs = extractFallbackFaqs(classifiedPages);
  }

  // Generate FAQ suggestions from structured knowledge (events, reservations, menus, memberships)
  const knowledgeFaqs = generateFaqsFromKnowledge(draft);
  if (knowledgeFaqs.length > 0) {
    const existingQuestions = new Set(draft.faqs.map((f) => f.question.toLowerCase()));
    for (const faq of knowledgeFaqs) {
      if (!existingQuestions.has(faq.question.toLowerCase())) {
        draft.faqs.push(faq);
        existingQuestions.add(faq.question.toLowerCase());
      }
    }
  }

  if (draft.policies.length === 0) {
    draft.policies = extractFallbackPolicies(classifiedPages);
  }

  return {
    pages: classifiedPages,
    signals: input.signals,
    draft,
  };
}

function generateFaqsFromKnowledge(draft: WebsiteImportDraft): WebsiteImportDraft["faqs"] {
  const faqs: WebsiteImportDraft["faqs"] = [];

  // Reservation FAQ
  const reservations = draft.restaurantKnowledge.reservations;
  if (reservations.include && (reservations.bookingUrl || reservations.instructions)) {
    const answer = [
      reservations.instructions ? reservations.instructions.slice(0, 200) : "",
      reservations.bookingUrl ? `Book online: ${reservations.bookingUrl}` : "",
      reservations.platforms.length ? `Available on ${reservations.platforms.join(", ")}.` : "",
    ].filter(Boolean).join(" ").trim();

    if (answer) {
      faqs.push({
        id: createId("faq"),
        question: "Do you take reservations?",
        answer,
        sourceUrl: reservations.sourceUrl,
        include: true,
        confidence: 0.9,
      });
    }

    if (reservations.depositPolicy) {
      faqs.push({
        id: createId("faq"),
        question: "What is your cancellation or deposit policy?",
        answer: reservations.depositPolicy.slice(0, 280),
        sourceUrl: reservations.sourceUrl,
        include: true,
        confidence: 0.8,
      });
    }
  }

  // Events FAQ
  const events = draft.restaurantKnowledge.events.filter((e) => e.include);
  if (events.length > 0) {
    const upcoming = events.slice(0, 3);
    const eventList = upcoming.map((e) => `${e.title}${e.date ? ` (${e.date})` : ""}`).join("; ");
    faqs.push({
      id: createId("faq"),
      question: "What events do you have coming up?",
      answer: `Upcoming events include: ${eventList}.${events.length > 3 ? ` Plus ${events.length - 3} more events.` : ""}`,
      sourceUrl: events[0].sourceUrl,
      include: true,
      confidence: 0.85,
    });

    const liveMusic = events.filter((e) => /music|live|dj|piano|jazz|band/i.test(`${e.title} ${e.category}`));
    if (liveMusic.length > 0) {
      faqs.push({
        id: createId("faq"),
        question: "Do you have live music?",
        answer: `Yes! ${liveMusic.slice(0, 3).map((e) => `${e.title}${e.date ? ` on ${e.date}` : ""}`).join("; ")}.`,
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
      answer: `Yes, we accommodate private events. Visit ${privateEvents.url} for more details.`,
      sourceUrl: privateEvents.url,
      include: true,
      confidence: 0.8,
    });
  }

  // Membership / Wine Club FAQ
  const memberships = draft.restaurantKnowledge.memberships;
  if (memberships.include && memberships.benefits) {
    faqs.push({
      id: createId("faq"),
      question: memberships.name ? `What is the ${memberships.name}?` : "Do you have a membership or club program?",
      answer: memberships.benefits.slice(0, 280),
      sourceUrl: memberships.sourceUrl,
      include: true,
      confidence: 0.85,
    });
  }

  // Hours FAQ
  if (draft.businessProfile.hours.value) {
    faqs.push({
      id: createId("faq"),
      question: "What are your hours?",
      answer: draft.businessProfile.hours.value,
      sourceUrl: draft.businessProfile.hours.sourceUrl,
      include: true,
      confidence: 0.9,
    });
  }

  // Location / Contact FAQ
  if (draft.businessProfile.address.value) {
    const parts = [
      draft.businessProfile.address.value,
      draft.businessProfile.phone.value ? `Phone: ${draft.businessProfile.phone.value}` : "",
      draft.businessProfile.email.value ? `Email: ${draft.businessProfile.email.value}` : "",
    ].filter(Boolean);

    faqs.push({
      id: createId("faq"),
      question: "Where are you located?",
      answer: parts.join(". "),
      sourceUrl: draft.businessProfile.address.sourceUrl,
      include: true,
      confidence: 0.9,
    });
  }

  // Menu highlights FAQ
  const menuSections = draft.restaurantKnowledge.menuSections.filter((m) => m.include);
  if (menuSections.length > 0) {
    const sectionNames = menuSections.map((s) => s.title).slice(0, 4);
    const itemCount = menuSections.reduce((sum, s) => sum + s.items.length, 0);
    faqs.push({
      id: createId("faq"),
      question: "What kind of food do you serve?",
      answer: `Our menu features${sectionNames.length > 0 ? `: ${sectionNames.join(", ")}` : ` ${itemCount} items`}.${menuSections[0].sourceUrl ? ` View our full menu at ${menuSections[0].sourceUrl}` : ""}`,
      sourceUrl: menuSections[0].sourceUrl,
      include: true,
      confidence: 0.75,
    });
  }

  return faqs;
}
