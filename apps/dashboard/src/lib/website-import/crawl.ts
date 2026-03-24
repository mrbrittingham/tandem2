import type { CrawledPage, ImportSignals, SocialLink } from "./types";
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
};

type LinkCandidate = {
  url: string;
  score: number;
  depth: number;
  anchorText: string;
  sourceSection: "nav" | "header" | "footer" | "button" | "content";
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
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,14}\d)(?!\d)/g;
const HOURS_PATTERN = /\b(?:hours|tasting room hours|open|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[^\n]{0,180}(?:\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?\s?(?:-|–|to)\s?\d{1,2}[:.]?\d{0,2}\s?(?:am|pm)?|closed|noon)/i;
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'#\-\s]{3,80}\s(?:street|avenue|ave|boulevard|blvd|road|lane|drive|way|suite|unit|st|rd|ln|dr|ste)\.?\b[,.\s]*(?:[A-Za-z\s.]+,?\s*)?(?:[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/i;
const TRACKING_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "mc_cid", "mc_eid"]);
const JUNK_QUERY_PREFIXES = ["utm_", "oly_", "vero_", "hsa_"];
const JUNK_PATH_REGEX = /(\/tag\/|\/category\/|\/author\/|\/feed\/?$|\/wp-admin|\/wp-json|\/xmlrpc\.php|\/cart|\/checkout|\/my-account|\/search\b|\?s=)/i;
const JUNK_FILENAME_REGEX = /\.(xml|rss|txt|csv|json)(\?|$)/i;
const BOOKING_PLATFORM_REGEX = /(opentable|resy|tock|toasttab|sevenrooms|exploretock|bookeo)/i;
const BOOKING_LINK_HINT_REGEX = /(reserve|reservation|book\s+now|book\s+a\s+table|book\s+an\s+experience|tickets?|rsvp)/i;
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

function normalizeCrawlUrl(raw: string, baseUrl: string): string | null {
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

  // Context-aware color extraction: 6 passes so the ranker can weight colors by source zone.
  // Pass 0 – CSS custom properties in <style> blocks → highest-confidence brand signal.
  //           Modern builders (Elementor, Squarespace, Webflow, Shopify, Wix, Divi, WP FSE)
  //           store the brand palette as semantically-named CSS variables. Pass 0b also
  //           extracts hex values from CSS rules with brand-zone selectors.
  // Pass 1 – inline SVG blocks (logo fills, icon paths) → strong logo identity signal.
  // Pass 2 – <nav> / <header> blocks → layout chrome (penalized in ranker).
  // Pass 3 – <footer> blocks → brand identity zone (positive bonus in ranker).
  // Pass 4 – <button> elements and CTA-styled anchors → intentional brand accent signal.
  // Pass 5 – remaining HTML after stripping all named zones, so earlier passes are
  //           NOT double-counted with context="style".

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

        // Text color in nav/header: gold/brand-colored nav links are a strong signal
        // (e.g. Windmill Creek's gold logo text and navigation links)
        if (isNavHeader) {
          const COLOR_RE = /(?:^|;)\s*color\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/gi;
          let textMatch: RegExpExecArray | null;
          while ((textMatch = COLOR_RE.exec(declarations)) !== null) {
            const norm = normalizeHexColor(textMatch[1] ?? "");
            // Push as "svg" context to get the svg-level bonus for logo/brand text colors
            // that appear in header/nav CSS rules — these are intentional brand choices.
            if (norm) signals.colorCandidates.push({ value: norm, sourceUrl: pageUrl, context: "nav" });
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

    // Pass 2: nav/header — layout chrome (ranker applies a navRatio penalty).
    for (const block of collectRegexMatches(html, /<(?:nav|header)(?:\s[^>]*)?>(?:[\s\S]*?)<\/(?:nav|header)>/gi)) {
      for (const val of collectRegexMatches(block, HEX_RE)) {
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
    const bodyHtml = html
      .replace(/<svg(?:\s[^>]*)?>(?:[\s\S]*?)<\/svg>/gi, "")
      .replace(/<(?:nav|header)(?:\s[^>]*)?>(?:[\s\S]*?)<\/(?:nav|header)>/gi, "")
      .replace(/<footer(?:\s[^>]*)?>(?:[\s\S]*?)<\/footer>/gi, "")
      .replace(/<(?:button(?:\s[^>]*)?|(?:a|div|span)\s[^>]*class=["'][^"']*\b(?:btn|button|cta)\b[^"']*["'][^>]*)>[\s\S]*?<\/(?:button|a|div|span)>/gi, "");
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
  const queue: LinkCandidate[] = [{ url: normalizedSeed, score: 140, depth: 0, anchorText: "seed", sourceSection: "content" }];
  const discovered = new Map<string, { score: number; count: number; depth: number }>();
  const anchorTextsByUrl = new Map<string, Set<string>>();

  const enqueue = (candidate: LinkCandidate) => {
    if (candidate.depth > WEBSITE_IMPORT_LIMITS.maxDepth) {
      return;
    }

    const existing = discovered.get(candidate.url);
    if (!existing) {
      discovered.set(candidate.url, {
        score: candidate.score,
        count: 1,
        depth: candidate.depth,
      });
      queue.push(candidate);
    } else {
      existing.count += 1;
      existing.depth = Math.min(existing.depth, candidate.depth);
      existing.score = Math.max(existing.score, candidate.score + Math.min(existing.count * 3, 24));
      for (const queued of queue) {
        if (queued.url === candidate.url) {
          queued.score = Math.max(queued.score, existing.score);
          queued.depth = Math.min(queued.depth, existing.depth);
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

  for (const path of HIGH_SIGNAL_PATHS) {
    const candidate = normalizeCrawlUrl(path, normalizedSeed);
    if (!candidate) {
      continue;
    }
    enqueue({
      url: candidate,
      score: 96 + linkPriorityScore(candidate),
      depth: 1,
      anchorText: path,
      sourceSection: "nav",
    });
  }

  queue.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];

  const signals: ImportSignals = {
    emails: [],
    phones: [],
    addresses: [],
    hours: [],
    bookingLinks: [],
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

    const currentDepth = next?.depth ?? 0;
    if (currentDepth > WEBSITE_IMPORT_LIMITS.maxDepth) {
      continue;
    }

    seen.add(nextUrl);

    console.log(`[crawl] depth=${currentDepth} score=${next?.score ?? 0} url=${nextUrl}`);

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

    const lowerUrl = nextUrl.toLowerCase();
    const haystack = `${lowerUrl} ${title}`;
    const needsStructuredText = /menu|food|dining|drink|wine|cocktail|brunch|dinner|lunch|faq|frequently|policy|policies|about|private.event|club|membership|contact|hours|visit|reservation|dog|pet|parking|dress|cancel/i.test(haystack);
    const structuredText = needsStructuredText ? excerptText(htmlToStructuredText(html), excerptLimit) : undefined;

    const metaDescription = extractMetaDescription(html);
    const headingText = extractHeadingText(html);
    const sourceAnchorTexts = Array.from(anchorTextsByUrl.get(nextUrl) ?? []).slice(0, 12);

    pages.push({
      url: nextUrl,
      title,
      textExcerpt,
      structuredText,
      pageType: classifyPageType({ url: nextUrl, title, textExcerpt, metaDescription, headingText, sourceAnchorTexts }),
      metaDescription,
      headingText,
      sourceAnchorTexts,
    });

    totalChars += textExcerpt.length;

    if (options?.onPageCrawled) {
      await options.onPageCrawled([...pages]);
    }

    collectSignalsFromHtml({ html, signalText, footerText, pageUrl: nextUrl, signals });

    const links = extractLinks(html, nextUrl, currentDepth);
    for (const link of links) {
      if (!isSameDomain(normalizedSeed, link.url) || seen.has(link.url)) {
        continue;
      }
      enqueue(link);
    }

    queue.sort((left, right) => {
      const l = discovered.get(left.url);
      const r = discovered.get(right.url);
      const lScore = (l?.score ?? left.score) - left.depth * 4;
      const rScore = (r?.score ?? right.score) - right.depth * 4;
      return rScore - lScore;
    });
  }

  console.log(`[crawl] Finished: ${pages.length} pages crawled, ${seen.size} URLs visited, ${queue.length} remaining in queue`);
  for (const page of pages) {
    const path = new URL(page.url).pathname;
    console.log(`[crawl]   ${path} — "${page.title}"`);
  }

  return {
    pages,
    signals: dedupeSignals(signals),
  };
}
