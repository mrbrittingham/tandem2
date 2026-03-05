import type { CrawledPage, ImportSignals, SocialLink } from "./types";
import {
  WEBSITE_IMPORT_LIMITS,
  decodeHtml,
  excerptText,
  extractTitle,
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
};

type LinkCandidate = {
  url: string;
  score: number;
};

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
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const HOURS_PATTERN = /\b(?:hours|tasting room hours|open|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[^\n]{0,180}(?:\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?\s?(?:-|–|to)\s?\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?|closed|noon)/i;
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'#\-\s]{3,80}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|suite|ste\.?|unit)\b[^\n]{0,120}/i;
const TRACKING_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "mc_cid", "mc_eid"]);
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
  "/events",
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

function normalizeCrawlUrl(raw: string, baseUrl: string): string | null {
  const normalized = normalizeCandidateUrl(raw, baseUrl);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
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

    const lowerPath = url.pathname.toLowerCase();
    if (
      /\/tag\//.test(lowerPath)
      || /\/category\//.test(lowerPath)
      || /\/page\/\d+/.test(lowerPath)
      || /\/calendar/.test(lowerPath)
      || /\/wp-admin/.test(lowerPath)
      || /\/wp-json/.test(lowerPath)
    ) {
      return null;
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

function extractLinks(html: string, pageUrl: string): LinkCandidate[] {
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
    const bonus =
      /contact|about|faq|hours|visit|reserv|book|menu|event|policy|privacy|terms/.test(anchorText)
        ? 16
        : 0;

    links.push({
      url: normalized,
      score: linkPriorityScore(normalized) + bonus,
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

  const addressMatch = ADDRESS_PATTERN.exec(signalText);
  if (addressMatch?.[0]) {
    signals.addresses.push({ value: addressMatch[0].trim(), sourceUrl: pageUrl });
  }

  const footerAddressMatch = ADDRESS_PATTERN.exec(footerText);
  if (footerAddressMatch?.[0]) {
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

  const colorPattern = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
  for (const value of collectRegexMatches(html, colorPattern)) {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      signals.colorCandidates.push({ value: normalized, sourceUrl: pageUrl });
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

function dedupeSignals(signals: ImportSignals): ImportSignals {
  return {
    emails: uniqueBy(signals.emails, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    phones: uniqueBy(signals.phones, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    addresses: uniqueBy(signals.addresses, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    hours: uniqueBy(signals.hours, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
    socialLinks: uniqueBy(signals.socialLinks, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    logoCandidates: uniqueBy(signals.logoCandidates, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    faviconCandidates: uniqueBy(signals.faviconCandidates, (entry) => `${entry.url.toLowerCase()}::${entry.sourceUrl}`),
    colorCandidates: uniqueBy(signals.colorCandidates, (entry) => `${entry.value.toUpperCase()}::${entry.sourceUrl}`),
    fontCandidates: uniqueBy(signals.fontCandidates, (entry) => `${entry.value.toLowerCase()}::${entry.sourceUrl}`),
  };
}

export async function crawlWebsite(seedUrl: string): Promise<CrawlResult> {
  const normalizedSeed = normalizeWebsiteUrl(seedUrl);
  const queue: LinkCandidate[] = [{ url: normalizedSeed, score: 100 }];

  for (const path of HIGH_SIGNAL_PATHS) {
    const candidate = normalizeCrawlUrl(path, normalizedSeed);
    if (!candidate) {
      continue;
    }
    queue.push({ url: candidate, score: 80 + linkPriorityScore(candidate) });
  }

  queue.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];

  const signals: ImportSignals = {
    emails: [],
    phones: [],
    addresses: [],
    hours: [],
    socialLinks: [],
    logoCandidates: [],
    faviconCandidates: [],
    colorCandidates: [],
    fontCandidates: [],
  };

  let totalChars = 0;

  while (queue.length > 0 && pages.length < WEBSITE_IMPORT_LIMITS.maxPages && totalChars < WEBSITE_IMPORT_LIMITS.maxChars) {
    const next = queue.shift();
    const nextUrl = next?.url;
    if (!nextUrl || seen.has(nextUrl)) {
      continue;
    }
    seen.add(nextUrl);

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

    if (!response.ok) {
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      continue;
    }

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
    if (!text && !signalText) {
      continue;
    }

    const remaining = WEBSITE_IMPORT_LIMITS.maxChars - totalChars;
    const excerptLimit = Math.min(WEBSITE_IMPORT_LIMITS.perPageChars, Math.max(0, remaining));
    const textExcerpt = excerptText(text || signalText, excerptLimit);
    if (!textExcerpt) {
      continue;
    }

    pages.push({
      url: nextUrl,
      title,
      textExcerpt,
    });

    totalChars += textExcerpt.length;

    collectSignalsFromHtml({ html, signalText, footerText, pageUrl: nextUrl, signals });

    const links = extractLinks(html, nextUrl);
    for (const link of links) {
      if (!isSameDomain(normalizedSeed, link.url) || seen.has(link.url)) {
        continue;
      }
      queue.push(link);
    }

    queue.sort((a, b) => b.score - a.score);
  }

  return {
    pages,
    signals: dedupeSignals(signals),
  };
}
