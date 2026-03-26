export const WEBSITE_IMPORT_LIMITS = {
  maxPages: Number(process.env.WEBSITE_IMPORT_MAX_PAGES ?? 48),
  maxChars: 420_000,
  perPageChars: 24_000,
  requestTimeoutMs: 12_000,
  maxDepth: Number(process.env.WEBSITE_IMPORT_MAX_DEPTH ?? 3),
};

export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Website URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Website URL must use http or https");
  }

  url.hash = "";
  return url.toString();
}

export function normalizeCandidateUrl(raw: string, baseUrl: string): string | null {
  if (!raw) {
    return null;
  }

  const candidate = raw.trim();
  if (!candidate || candidate.startsWith("#") || candidate.startsWith("javascript:") || candidate.startsWith("mailto:") || candidate.startsWith("tel:")) {
    return null;
  }

  try {
    const next = new URL(candidate, baseUrl);
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      return null;
    }
    next.hash = "";
    return next.toString();
  } catch {
    return null;
  }
}

export function getDomain(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function isSameDomain(leftUrl: string, rightUrl: string): boolean {
  return getDomain(leftUrl) === getDomain(rightUrl);
}

export function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return decodeHtml((match?.[1] ?? "").trim()).slice(0, 180);
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function htmlToText(html: string): string {
  const withoutNoisyBlocks = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const stripped = withoutNoisyBlocks.replace(/<[^>]+>/g, " ");
  return stripBoilerplateText(decodeHtml(stripped)).replace(/\s+/g, " ").trim();
}

/**
 * Removes known platform/accessibility boilerplate that survives HTML stripping.
 * Targets: accessibility skip links, platform attribution, SPA shell UI chrome,
 * booking/calendar widget scaffolding text.
 */
export function stripBoilerplateText(text: string): string {
  return text
    // Accessibility skip links
    .replace(/\bskip\s+to\s+(?:main\s+)?content\b[^.]*?(?=\s|$)/gi, "")
    .replace(/\bskip\s+(?:navigation|to\s+nav)\b[^.]*?(?=\s|$)/gi, "")
    // Link accessibility labels injected by CMS / accessibility overlays
    .replace(/[\[(]?\bopens?\s+in\s+a\s+new\s+(?:window|tab)\b[\])]?/gi, "")
    .replace(/\bopen\s+in\s+new\s+(?:window|tab)\b/gi, "")
    // Booking/calendar platform UI chrome
    .replace(/\bload\s+more\s+(?:content|results?|events?|items?)\b/gi, "")
    .replace(/\bpowered\s+by\s+[A-Za-z0-9\s]+\b(?=\.|$|,)/gi, "")
    .replace(/\bmade\s+with\s+[A-Za-z0-9\s]+\b(?=\.|$|,)/gi, "")
    .replace(/\bbuilt\s+(?:with|on|using)\s+[A-Za-z0-9\s]+\b(?=\.|$|,)/gi, "")
    // Toast / BentoBox / Lightspeed / scheduling platform shell text
    .replace(/\bsquarespace\s+(?:scheduling|booking)\b[^.]*?(?=\s|$)/gi, "")
    .replace(/\bsquare\s+online\s+store\b[^.]*?(?=\s|$)/gi, "")
    .replace(/\btoast(?:tab)?\s+online\s+ordering\b[^.]*?(?=\s|$)/gi, "")
    // Pagination / infinite scroll UI
    .replace(/\bview\s+(?:all|more)\s+(?:events?|results?|items?|posts?)\b/gi, "")
    .replace(/\bsee\s+(?:all|more)\s+(?:events?|results?|items?|posts?)\b/gi, "")
    // Calendar widget noise
    .replace(/\b(?:previous|next)\s+month\b/gi, "")
    .replace(/\bmonthly\s+view\b|\bweekly\s+view\b|\blist\s+view\b/gi, "")
    .replace(/\badd\s+to\s+(?:google\s+)?calendar\b/gi, "")
    .replace(/\biCal\s+download\b/gi, "")
    // Social share buttons text
    .replace(/\bshare\s+(?:on|via|this|to)\s+(?:facebook|twitter|instagram|x|linkedin|pinterest|email)\b/gi, "")
    // Cookie / privacy banners
    .replace(/\baccept\s+(?:all\s+)?cookies\b[^.]*?(?:\.|$)/gi, "")
    .replace(/\bwe\s+use\s+cookies\b[^.]*?(?:\.|$)/gi, "")
    // Breadcrumb separators left after HTML stripping
    .replace(/(?<=\s)|^\s*>\s*|\s*\|\s*(?=[A-Z])/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Preserves heading markers (##) in text for structured section parsing.
 * Used by menu extraction to detect sections.
 */
export function htmlToStructuredText(html: string): string {
  const withoutNoisyBlocks = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const withHeadings = withoutNoisyBlocks
    .replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, (_m, text: string) => `\n## ${decodeHtml(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, text: string) => `\n- ${decodeHtml(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtml(withHeadings).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  // Strip boilerplate from each line to keep heading markers intact
  return decoded.split("\n").map((line) => {
    if (line.startsWith("## ") || line.startsWith("- ")) {
      const prefix = line.startsWith("## ") ? "## " : "- ";
      return prefix + stripBoilerplateText(line.slice(prefix.length));
    }
    return stripBoilerplateText(line);
  }).filter((line) => line.replace(/^##\s*$|^-\s*$/, "").trim().length > 0).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

const PRIORITY_PATH_HINTS = [
  // Core restaurant pages — highest crawl priority
  "contact",
  "about",
  "faq",
  "faqs",
  "help",
  "hours",
  "menu",
  "food",
  "drink",
  "dining",
  "dinner",
  "lunch",
  "brunch",
  "cocktail",
  "wine",
  "beer",
  "kitchen",
  "restaurant",
  "reservation",
  "reservations",
  "booking",
  "opentable",
  "resy",
  "event",
  "calendar",
  "music",
  "happenings",
  "upcoming",
  "wedding",
  "private-event",
  "private-dining",
  "group-dining",
  "club",
  "membership",
  "catering",
  "policy",
  "policies",
  "cancellation",
  "privacy",
  "terms",
  // Intentionally removed: "service", "pricing", "shipping", "return"
  // Those are e-commerce/retail signals that inflate scores for product pages
  // and are not core restaurant content pages.
];

export function linkPriorityScore(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  for (const hint of PRIORITY_PATH_HINTS) {
    if (lower.includes(hint)) {
      score += 10;
    }
  }
  if (lower.endsWith(".pdf") || lower.endsWith(".jpg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".zip")) {
    score -= 100;
  }
  return score;
}

export function looksLikeBinaryAsset(url: string): boolean {
  return /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|mp4|mp3|woff2?|ttf|eot)(\?|$)/i.test(url);
}

export function excerptText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Brand color ranking helpers ──────────────────────────────────────────────

/** Convert a validated 6-char hex to [hue 0-360, saturation 0-100, lightness 0-100]. */
function hexToHslTriplet(hex: string): [number, number, number] | null {
  if (!/^#[0-9A-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  h /= 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Colors that are common CSS/browser defaults carrying no brand signal.
 * Pure achromatic values, near-blacks, near-whites, and web-safe grays.
 */
const GENERIC_HEX_COLORS = new Set([
  "#000000", "#111111", "#222222", "#333333", "#444444", "#555555",
  "#666666", "#777777", "#888888", "#999999", "#AAAAAA", "#BBBBBB",
  "#CCCCCC", "#DDDDDD", "#EEEEEE", "#FFFFFF", "#FAFAFA", "#F9F9F9",
  "#F8F8F8", "#F5F5F5", "#F2F2F2", "#F0F0F0", "#EBEBEB", "#E8E8E8",
  "#E5E5E5", "#E0E0E0", "#D9D9D9", "#D0D0D0", "#C8C8C8", "#C0C0C0",
  "#1A1A1A", "#1C1C1C", "#212121", "#2A2A2A", "#2D2D2D", "#3C3C3C",
  "#404040", "#484848", "#4A4A4A", "#505050", "#585858", "#606060",
]);

/**
 * Extra score for hues that appear frequently in premium hospitality brand palettes:
 * deep reds, burgundies, wines, golds, ambers, warm oranges.
 * Blues (common web/nav default) are penalized, especially dark or desaturated ones.
 */
function warmHueScore(hue: number, saturation: number, lightness: number): number {
  if (saturation < 18) return 0;
  if (hue <= 20 || hue >= 345) return 16;   // true reds, crimsons, scarlets
  if (hue > 20 && hue <= 55) return 14;     // oranges, golds, ambers, warm earth
  if (hue > 270 && hue < 345) return 12;    // wines, magentas, rose, deep purples
  if (hue > 55 && hue <= 100) return 2;     // amber/yellow edge (low hospitality signal)
  if (hue > 100 && hue <= 160) return -4;   // greens/limes/teals: uncommon in food branding
  if (hue > 160 && hue <= 265) {            // cyans, teals, blues: extremely common web/UI defaults
    // Most Elementor/Squarespace/Wix defaults live in this range (teal blues, sky blues).
    // Dark or desaturated values are always layout chrome; bright cyans/teals are usually
    // framework defaults or decorative accents — not physical brand colors.
    if (lightness < 40 || saturation < 40) return -16;
    return -10;
  }
  return 0;
}

/**
 * Rank raw hex color candidates extracted during a website crawl to surface
 * the most likely brand-representative colors.
 *
 * Filters out:
 *  - near-black values (L < 15) — generic text/shadow/dark-nav colors
 *  - near-white values (L > 91) — background/surface noise
 *  - achromatic grays (S < 10) — UI chrome, not brand
 *  - values in the generic web-color blocklist
 *
 * Before scoring, near-duplicate hex values (same hue family ≤15° apart AND
 * lightness within 18 points) are clustered into their most-saturated form with
 * counts aggregated — preventing rendering variants from splitting brand-signal votes.
 *
 * Scores remaining candidates by:
 *  - effective frequency (brand-zone full weight, nav 40% weight, log scale)
 *  - saturation (intentional brand colors tend to be more saturated)
 *  - lightness in the "visible brand" range (25–70%)
 *  - warm hue bonus (reds, golds, wines typical of restaurant/hospitality)
 *  - context bonus: logo container/brand-mark (+60), SVG fills/strokes (+42),
 *                   button/CTA backgrounds (+28), footer zone (+16),
 *                   explicit background-color CSS (+18)
 *  - CSS custom property bonus: primary (+65), accent (+55), secondary (+40), generic (+25)
 *  - builder default penalty (-18) if cssvar is used but never in logo/svg/button/footer zones
 *  - nav penalty: colors appearing predominantly in nav/header (-8 to -22),
 *      UNLESS the color also has logo/svg presence (those ARE brand colors)
 *
 * Returns candidates sorted high-to-low by brand-signal score, each tagged
 * with their dominant zone ("logo" | "svg" | "button" | "footer" | "bg" | "nav" | "style").
 */

export function rankBrandColorCandidates(
  candidates: Array<{ value: string; sourceUrl: string; context?: string }>,
): Array<{ value: string; sourceUrl: string; zone: string }> {
  console.log(`[color-rank] ★ NEW COLOR ENGINE ACTIVE ★  (${candidates.length} input candidates)`);

  // ── ColorData: all per-color counters accumulated during the frequency pass ──
  type ColorData = {
    count: number;
    logoCount: number;
    svgCount: number;
    navCount: number;
    navBgCount: number;     // background-color from nav/header = solid brand backdrop
    sectionBgCount: number; // background-color from <section>/<main>/<article>/layout <div>
    buttonCount: number;
    footerCount: number;
    bgCount: number;
    cssvarPrimaryCount: number;
    cssvarAccentCount: number;
    cssvarSecondaryCount: number;
    cssvarCount: number;
    areaWeight: number;     // accumulated visual-area proxy ∑ baseAreaWeight(context) per instance
    sourceUrl: string;
  };

  // ── Area-weight lookup ───────────────────────────────────────────────────────
  // Each context has an inherent visual-area proxy reflecting how large a portion of
  // the page that source zone typically covers. Accumulated across all instances to
  // produce a totalAreaWeight that feeds the areaBonus in scoring.
  //   nav-bg / section-bg: full-width bands or major sections → highest weight
  //   footer / cssvar-primary: full-width or site-wide application → high weight
  //   bg / cssvar variants: medium layout areas
  //   logo / nav / svg / button / style: small or unknown visual mass → low weight
  function baseAreaWeight(ctx: string): number {
    switch (ctx) {
      case "nav-bg":           return 9;  // full-width navbar backdrop
      case "section-bg":       return 8;  // major page section (large visual area)
      case "footer":           return 7;  // full-width footer block
      case "cssvar-primary":   return 7;  // applied site-wide across many large elements
      case "cssvar-accent":    return 5;
      case "cssvar-secondary": return 5;
      case "cssvar":           return 4;
      case "bg":               return 4;  // explicit bg-color in body content
      case "nav":              return 3;  // nav text/border — smaller area than the backdrop
      case "logo":             return 3;
      case "svg":              return 2;
      case "button":           return 2;
      default:                 return 1;  // "style" catch-all
    }
  }

  // ── Frequency pass ───────────────────────────────────────────────────────────
  const freq = new Map<string, ColorData>();

  for (const c of candidates) {
    const key = c.value.toUpperCase();
    const ctx = c.context ?? "style";
    const w = baseAreaWeight(ctx);
    const existing = freq.get(key);
    if (existing) {
      existing.count += 1;
      existing.areaWeight += w;
      if (ctx === "logo")           existing.logoCount += 1;
      if (ctx === "svg")            existing.svgCount += 1;
      if (ctx === "nav")            existing.navCount += 1;
      if (ctx === "nav-bg")         existing.navBgCount += 1;
      if (ctx === "section-bg")     existing.sectionBgCount += 1;
      if (ctx === "button")         existing.buttonCount += 1;
      if (ctx === "footer")         existing.footerCount += 1;
      if (ctx === "bg")             existing.bgCount += 1;
      if (ctx === "cssvar-primary") existing.cssvarPrimaryCount += 1;
      if (ctx === "cssvar-accent")  existing.cssvarAccentCount += 1;
      if (ctx === "cssvar-secondary") existing.cssvarSecondaryCount += 1;
      if (ctx === "cssvar")         existing.cssvarCount += 1;
    } else {
      freq.set(key, {
        count: 1,
        areaWeight: w,
        logoCount:            ctx === "logo" ? 1 : 0,
        svgCount:             ctx === "svg" ? 1 : 0,
        navCount:             ctx === "nav" ? 1 : 0,
        navBgCount:           ctx === "nav-bg" ? 1 : 0,
        sectionBgCount:       ctx === "section-bg" ? 1 : 0,
        buttonCount:          ctx === "button" ? 1 : 0,
        footerCount:          ctx === "footer" ? 1 : 0,
        bgCount:              ctx === "bg" ? 1 : 0,
        cssvarPrimaryCount:   ctx === "cssvar-primary" ? 1 : 0,
        cssvarAccentCount:    ctx === "cssvar-accent" ? 1 : 0,
        cssvarSecondaryCount: ctx === "cssvar-secondary" ? 1 : 0,
        cssvarCount:          ctx === "cssvar" ? 1 : 0,
        sourceUrl: c.sourceUrl,
      });
    }
  }

  console.log(`[color-rank] ${candidates.length} raw candidates, ${freq.size} unique hex values`);

  // ── Clustering: merge near-duplicate hex variants ────────────────────────────
  // Sort by saturation desc first — the most-saturated form is the best cluster center.
  const clustered = new Map<string, ColorData>();
  {
    const items = [...freq.entries()]
      .map(([hex, data]) => ({ hex, hsl: hexToHslTriplet(hex), data }))
      .filter((item): item is typeof item & { hsl: [number, number, number] } => item.hsl !== null);
    items.sort((a, b) => b.hsl[1] - a.hsl[1]);
    const assigned = new Set<string>();
    for (const center of items) {
      if (assigned.has(center.hex)) continue;
      const cluster: ColorData = { ...center.data };
      assigned.add(center.hex);
      for (const candidate of items) {
        if (assigned.has(candidate.hex)) continue;
        const dh = Math.min(
          Math.abs(center.hsl[0] - candidate.hsl[0]),
          360 - Math.abs(center.hsl[0] - candidate.hsl[0]),
        );
        const dl = Math.abs(center.hsl[2] - candidate.hsl[2]);
        if (dh <= 15 && dl <= 18) {
          cluster.count              += candidate.data.count;
          cluster.areaWeight         += candidate.data.areaWeight;
          cluster.logoCount          += candidate.data.logoCount;
          cluster.svgCount           += candidate.data.svgCount;
          cluster.navCount           += candidate.data.navCount;
          cluster.navBgCount         += candidate.data.navBgCount;
          cluster.sectionBgCount     += candidate.data.sectionBgCount;
          cluster.buttonCount        += candidate.data.buttonCount;
          cluster.footerCount        += candidate.data.footerCount;
          cluster.bgCount            += candidate.data.bgCount;
          cluster.cssvarPrimaryCount   += candidate.data.cssvarPrimaryCount;
          cluster.cssvarAccentCount    += candidate.data.cssvarAccentCount;
          cluster.cssvarSecondaryCount += candidate.data.cssvarSecondaryCount;
          cluster.cssvarCount          += candidate.data.cssvarCount;
          assigned.add(candidate.hex);
        }
      }
      clustered.set(center.hex, cluster);
    }
    for (const [hex, data] of freq) {
      if (!assigned.has(hex)) clustered.set(hex, data);
    }
  }
  if (clustered.size < freq.size) {
    console.log(`[color-rank] clustered ${freq.size} → ${clustered.size} unique colors (merged ${freq.size - clustered.size} near-duplicates)`);
  }

  // ── Dominant zone label ──────────────────────────────────────────────────────
  function dominantZone(d: ColorData): string {
    if (d.cssvarPrimaryCount > 0)   return "cssvar-primary";
    if (d.cssvarAccentCount > 0)    return "cssvar-accent";
    if (d.cssvarSecondaryCount > 0) return "cssvar-secondary";
    if (d.cssvarCount > 0)          return "cssvar";
    if (d.logoCount > 0)            return "logo";
    if (d.svgCount > 0)             return "svg";
    if (d.buttonCount > 0)          return "button";
    if (d.footerCount > 0)          return "footer";
    if (d.navBgCount > 0)           return "nav-bg";
    if (d.sectionBgCount > 0)       return "section-bg";
    if (d.bgCount > 0)              return "bg";
    if (d.count > 0 && d.navCount / d.count > 0.5) return "nav";
    return "style";
  }

  // ── Scoring ──────────────────────────────────────────────────────────────────
  type ScoredEntry = {
    value: string;
    sourceUrl: string;
    score: number;
    zone: string;
    // Debug breakdown
    freqScore: number;
    satBonus: number;
    lightBonus: number;
    hueBonus: number;
    zoneBonus: number;
    areaBonus: number;
    navPenalty: number;
    builderPenalty: number;
  };
  const scored: ScoredEntry[] = [];

  for (const [value, data] of clustered) {
    if (GENERIC_HEX_COLORS.has(value)) continue;

    const hsl = hexToHslTriplet(value);
    if (!hsl) continue;
    const [h, s, l] = hsl;

    if (l < 15) continue;   // near-black: text/dark-nav backgrounds, not brand
    if (l > 91) continue;   // near-white: background noise
    if (s < 10) continue;   // achromatic: UI chrome, not brand

    const {
      count, logoCount, svgCount, navCount, navBgCount, sectionBgCount,
      buttonCount, footerCount, bgCount,
      cssvarPrimaryCount, cssvarAccentCount, cssvarSecondaryCount, cssvarCount,
      areaWeight, sourceUrl,
    } = data;

    // --- Frequency score ---
    // Brand-zone usages count fully; plain nav usages are discounted.
    // Logo/svg/button/footer/nav-bg/section-bg are definitive brand zones → full weight.
    // Nav is ambiguous (could be brand text OR layout chrome) → 40% weight.
    const brandZoneCount = logoCount + svgCount + buttonCount + footerCount + bgCount + navBgCount + sectionBgCount;
    const weightedCount = brandZoneCount + Math.round(navCount * 0.4) + Math.max(0, count - brandZoneCount - navCount);
    const freqScore = Math.min(Math.round(Math.log2(Math.max(1, weightedCount) + 1) * 10), 38);

    // --- Saturation bonus ---
    const cappedS = Math.min(s, 72);
    const satBonus = Math.round(cappedS * 0.45) - (s > 80 ? Math.round((s - 80) * 0.4) : 0);

    // --- Lightness bonus ---
    const lightBonus = l >= 25 && l <= 70 ? 14 : l > 70 && l <= 82 ? 5 : 0;

    // --- Hue bonus (hospitality bias) ---
    const hueBonus = warmHueScore(h, s, l);

    // --- Zone bonuses (brand-signal zones) ---
    let zoneBonus = 0;
    if (logoCount > 0)      zoneBonus += 60;  // logo container/brand-mark: strongest non-cssvar signal
    if (svgCount > 0)       zoneBonus += 42;  // inline SVG fill/stroke → logo identity color
    if (buttonCount > 0)    zoneBonus += 28;  // button/CTA → designer-intentional accent
    if (navBgCount > 0)     zoneBonus += 35;  // solid bg-color on nav/header = brand backdrop
    if (footerCount > 0)    zoneBonus += 16;  // footer: brand identity confirmation
    if (bgCount > 0)        zoneBonus += 18;  // explicit CSS background-color → deliberate
    if (sectionBgCount > 0) zoneBonus += 12;  // large layout-section bg: area signal confirmation

    // CSS custom property bonuses
    if (cssvarPrimaryCount > 0)   zoneBonus += 65;
    if (cssvarAccentCount > 0)    zoneBonus += 55;
    if (cssvarSecondaryCount > 0) zoneBonus += 40;
    if (cssvarCount > 0)          zoneBonus += 25;

    // --- Area weight bonus ---
    // Colors appearing on large visual areas accumulate more areaWeight points (∑ baseAreaWeight).
    // This rewards colors that dominate the visual field (full-width navbars, large section
    // backgrounds) and diminishes colors only seen in small elements (buttons, icons).
    //
    // SAFEGUARD against large neutral backgrounds:
    //   • Saturated/warm colors (s ≥ 20) receive full log-scaled bonus (up to +20).
    //   • Low-saturation colors (s < 20) receive a heavily capped bonus (up to +6).
    //     This prevents site-wide light grays and off-whites (which GENERIC_HEX_COLORS
    //     doesn't catch due to slight tinting) from overriding a visually dominant brand color.
    let areaBonus = 0;
    if (s >= 20) {
      // log2(areaWeight+1) * 4: weight=9 → ~12pts, weight=26 → ~18pts, capped at 20
      areaBonus = Math.min(Math.round(Math.log2(areaWeight + 1) * 4), 20);
    } else {
      // Low-saturation: small signal, capped at 6 — never enough to dethrone a brand primary
      areaBonus = Math.min(Math.round(Math.log2(areaWeight + 1) * 1.5), 6);
    }

    // --- Builder default defense ---
    let builderPenalty = 0;
    const hasCssvar = cssvarPrimaryCount + cssvarAccentCount + cssvarSecondaryCount + cssvarCount > 0;
    const hasBrandZone = logoCount + svgCount + buttonCount + footerCount + navBgCount + sectionBgCount > 0;
    if (hasCssvar && !hasBrandZone) {
      // CSS variable used but never in a physical brand zone — may be a framework default.
      builderPenalty = -18;
    }

    // --- Nav penalty ---
    // Colors predominantly in nav/header are layout chrome — penalized unless they also
    // appear in logo, SVG, or nav-bg contexts (those ARE brand colors).
    let navPenalty = 0;
    if (navCount > 0 && logoCount === 0 && svgCount === 0 && navBgCount === 0) {
      const navRatio = navCount / count;
      if (navRatio > 0.55) navPenalty = -22;
      else if (navRatio > 0.28) navPenalty = -8;
    }

    const score = freqScore + satBonus + lightBonus + hueBonus + zoneBonus + areaBonus + navPenalty + builderPenalty;

    scored.push({
      value,
      sourceUrl,
      score,
      zone: dominantZone(data),
      freqScore,
      satBonus,
      lightBonus,
      hueBonus,
      zoneBonus,
      areaBonus,
      navPenalty,
      builderPenalty,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // ── Saturation promotion safeguard ──────────────────────────────────────────
  // If the top-ranked color is low-saturation (S < 30) but a well-saturated warm-hued
  // color exists (reds, golds, wines — S > 50, H ≤ 80° or ≥ 270°) with a meaningful score,
  // promote that warm color to primary. This prevents builder-default grays/muted blues
  // from overriding an obvious brand identity color like a restaurant's signature red.
  if (scored.length >= 2) {
    const topEntry = scored[0]!;
    const topHsl = hexToHslTriplet(topEntry.value);
    if (topHsl && topHsl[1] < 30) {
      const warmIdx = scored.findIndex((c, i) => {
        if (i === 0) return false;
        const hsl = hexToHslTriplet(c.value);
        if (!hsl) return false;
        const [h, sat] = hsl;
        const isWarmSaturated = sat > 50 && (h <= 80 || h >= 270);
        const hasMeaningfulScore = c.score >= 40 && c.score >= topEntry.score * 0.35;
        return isWarmSaturated && hasMeaningfulScore;
      });
      if (warmIdx !== -1) {
        const [promoted] = scored.splice(warmIdx, 1);
        scored.unshift(promoted!);
        const promHsl = hexToHslTriplet(promoted!.value)!;
        console.log(
          `[color-rank] ⚡ saturation-guard: promoted warm ${promoted!.value}` +
          ` (H=${promHsl[0]} S=${promHsl[1]} zone=${promoted!.zone})` +
          ` over desaturated ${topEntry.value} (S=${topHsl[1]} zone=${topEntry.zone})`,
        );
      }
    }
  }

  // ── Rich debug output ────────────────────────────────────────────────────────
  if (scored.length > 0) {
    console.log(`[color-rank] ── TOP ${Math.min(15, scored.length)} RANKED CANDIDATES ──────────────────────────`);
    for (const c of scored.slice(0, 15)) {
      const hsl = hexToHslTriplet(c.value) ?? [0, 0, 0];
      const d = clustered.get(c.value)!;
      console.log(
        `[color-rank]  ${c.value}` +
        `  score=${c.score}` +
        `  zone=${c.zone}` +
        `  H=${hsl[0]} S=${hsl[1]} L=${hsl[2]}` +
        `  n=${d.count} areaW=${d.areaWeight}` +
        `  logo=${d.logoCount} svg=${d.svgCount} btn=${d.buttonCount}` +
        `  navBg=${d.navBgCount} secBg=${d.sectionBgCount} footer=${d.footerCount} bg=${d.bgCount} nav=${d.navCount}` +
        `  cvP=${d.cssvarPrimaryCount} cvA=${d.cssvarAccentCount} cvS=${d.cssvarSecondaryCount} cv=${d.cssvarCount}` +
        `  [freq=${c.freqScore} sat=${c.satBonus} light=${c.lightBonus} hue=${c.hueBonus} zone=${c.zoneBonus} area=${c.areaBonus} navPen=${c.navPenalty} bldPen=${c.builderPenalty}]`,
      );
    }
    console.log(`[color-rank] ── ${scored.length} candidates survived filters ──────────────────────────`);
  } else {
    console.log(`[color-rank] no brand-signal candidates survived filters (all values were generic/achromatic/dark)`);
  }

  return scored.map(({ value, sourceUrl, zone }) => ({ value, sourceUrl, zone }));
}
/**
 * Given a ranked color list and a chosen primary, find the best accent:
 * a color visually distinct from the primary (hue ≥28° apart, or L ≥22 pts different).
 * Prefers button-zone colors first — the designer explicitly chose them for interaction.
 * Falls back to frequency-ranked order if no button accent is found.
 */
export function pickDistinctAccentColor(
  rankedColors: Array<{ value: string; sourceUrl: string; zone?: string }>,
  primaryHex: string | null | undefined,
): { value: string; sourceUrl: string; zone?: string } | undefined {
  if (rankedColors.length < 2) return rankedColors[1];
  const primaryNorm = primaryHex?.toUpperCase();
  if (!primaryNorm) return rankedColors[1];

  const primaryHsl = hexToHslTriplet(primaryNorm);
  if (!primaryHsl) return rankedColors[1];
  const [ph, , pl] = primaryHsl;

  function isDistinct(c: (typeof rankedColors)[0]): boolean {
    if (c.value.toUpperCase() === primaryNorm) return false;
    const cHsl = hexToHslTriplet(c.value.toUpperCase());
    if (!cHsl) return false;
    const hueDiff = Math.abs(cHsl[0] - ph);
    const hueDist = Math.min(hueDiff, 360 - hueDiff);
    return hueDist >= 28 || Math.abs(cHsl[2] - pl) >= 22;
  }

  // Prefer an explicitly-named accent variable or button-zone color — the designer chose it
  const namedAccent = rankedColors.slice(1).find((c) => (c.zone === "cssvar-accent" || c.zone === "button") && isDistinct(c));
  if (namedAccent) return namedAccent;

  return rankedColors.slice(1).find(isDistinct) ?? rankedColors[1];
}

/**
 * Find the most likely page surface color from explicit CSS background-color declarations
 * in the scanned pages. Only considers light, low-saturation values (L ≥ 88, S < 28)
 * that are not in the generic-color blocklist — indicating a deliberate soft tint the
 * designer chose as the page surface rather than pure white.
 * Returns null if no distinctive light surface is found (caller should fall back to
 * warm-tint derivation from primary).
 */
export function pickSurfaceColor(
  candidates: Array<{ value: string; sourceUrl: string; context?: string }>,
): string | null {
  const freq = new Map<string, number>();
  for (const c of candidates) {
    if (c.context !== "bg") continue;
    const key = c.value.toUpperCase();
    if (GENERIC_HEX_COLORS.has(key)) continue;
    const hsl = hexToHslTriplet(key);
    if (!hsl) continue;
    const [, s, l] = hsl;
    if (l < 88 || s > 28) continue; // only very light, low-sat intentional surface tints
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  if (freq.size === 0) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [hex, count] of freq) {
    if (count > bestCount) { best = hex; bestCount = count; }
  }
  return best;
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  const candidate = (value ?? "").trim();
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(candidate);
  if (!match) {
    return null;
  }

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((entry) => `${entry}${entry}`)
      .join("")
      .toUpperCase()}`;
  }

  return `#${hex.toUpperCase()}`;
}

export function pickReadableTextColor(backgroundHex: string | null | undefined): string {
  const normalized = normalizeHexColor(backgroundHex) ?? "#3170FC";
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0F172A" : "#FFFFFF";
}
