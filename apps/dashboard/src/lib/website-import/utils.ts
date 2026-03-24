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
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const stripped = withoutNoisyBlocks.replace(/<[^>]+>/g, " ");
  return decodeHtml(stripped).replace(/\s+/g, " ").trim();
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

  return decodeHtml(withHeadings).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const PRIORITY_PATH_HINTS = [
  "contact",
  "about",
  "faq",
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
  "group-dining",
  "club",
  "membership",
  "service",
  "pricing",
  "policy",
  "shipping",
  "return",
  "cancellation",
  "privacy",
  "terms",
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
  if (hue > 55 && hue <= 100) return 2;     // yellow-greens (low hospitality signal)
  if (hue > 175 && hue <= 265) {            // blues: common nav/web default
    // Dark or desaturated blues are almost always layout chrome, not brand colors
    if (lightness < 40 || saturation < 40) return -12;
    return -4;
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
 *  - effective frequency (non-nav occurrences weighted, log scale)
 *  - saturation (intentional brand colors tend to be more saturated)
 *  - lightness in the "visible brand" range (25–70%)
 *  - warm hue bonus (reds, golds, wines typical of restaurant/hospitality)
 *  - context bonus: SVG fills/strokes (+42), button/CTA backgrounds (+28),
 *                   footer zone (+16), explicit background-color CSS (+18)
 *  - context penalty: colors appearing predominantly in nav/header (-8 to -22)
 *
 * Returns candidates sorted high-to-low by brand-signal score, each tagged
 * with their dominant zone ("svg" | "button" | "footer" | "bg" | "nav" | "style").
 */
export function rankBrandColorCandidates(
  candidates: Array<{ value: string; sourceUrl: string; context?: string }>,
): Array<{ value: string; sourceUrl: string; zone: string }> {
  type ColorData = { count: number; svgCount: number; navCount: number; buttonCount: number; footerCount: number; bgCount: number; cssvarPrimaryCount: number; cssvarAccentCount: number; cssvarSecondaryCount: number; cssvarCount: number; sourceUrl: string };
  const freq = new Map<string, ColorData>();

  for (const c of candidates) {
    const key = c.value.toUpperCase();
    const ctx = c.context ?? "style";
    const existing = freq.get(key);
    if (existing) {
      existing.count += 1;
      if (ctx === "svg") existing.svgCount += 1;
      if (ctx === "nav") existing.navCount += 1;
      if (ctx === "button") existing.buttonCount += 1;
      if (ctx === "footer") existing.footerCount += 1;
      if (ctx === "bg") existing.bgCount += 1;
      if (ctx === "cssvar-primary") existing.cssvarPrimaryCount += 1;
      if (ctx === "cssvar-accent") existing.cssvarAccentCount += 1;
      if (ctx === "cssvar-secondary") existing.cssvarSecondaryCount += 1;
      if (ctx === "cssvar") existing.cssvarCount += 1;
    } else {
      freq.set(key, {
        count: 1,
        svgCount: ctx === "svg" ? 1 : 0,
        navCount: ctx === "nav" ? 1 : 0,
        buttonCount: ctx === "button" ? 1 : 0,
        footerCount: ctx === "footer" ? 1 : 0,
        bgCount: ctx === "bg" ? 1 : 0,
        cssvarPrimaryCount: ctx === "cssvar-primary" ? 1 : 0,
        cssvarAccentCount: ctx === "cssvar-accent" ? 1 : 0,
        cssvarSecondaryCount: ctx === "cssvar-secondary" ? 1 : 0,
        cssvarCount: ctx === "cssvar" ? 1 : 0,
        sourceUrl: c.sourceUrl,
      });
    }
  }

  console.log(`[color-rank] ${candidates.length} raw candidates, ${freq.size} unique hex values`);

  // Cluster near-duplicate hex variants so rendering noise doesn't dilute brand signal.
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
          cluster.count += candidate.data.count;
          cluster.svgCount += candidate.data.svgCount;
          cluster.navCount += candidate.data.navCount;
          cluster.buttonCount += candidate.data.buttonCount;
          cluster.footerCount += candidate.data.footerCount;
          cluster.bgCount += candidate.data.bgCount;
          cluster.cssvarPrimaryCount += candidate.data.cssvarPrimaryCount;
          cluster.cssvarAccentCount += candidate.data.cssvarAccentCount;
          cluster.cssvarSecondaryCount += candidate.data.cssvarSecondaryCount;
          cluster.cssvarCount += candidate.data.cssvarCount;
          assigned.add(candidate.hex);
        }
      }
      clustered.set(center.hex, cluster);
    }
    // Colors that failed hexToHslTriplet cannot be clustered — pass through unchanged
    for (const [hex, data] of freq) {
      if (!assigned.has(hex)) clustered.set(hex, data);
    }
  }
  if (clustered.size < freq.size) {
    console.log(`[color-rank] clustered ${freq.size} → ${clustered.size} unique colors (merged ${freq.size - clustered.size} near-duplicates)`);
  }

  function dominantZone(d: ColorData): string {
    if (d.cssvarPrimaryCount > 0) return "cssvar-primary";
    if (d.cssvarAccentCount > 0) return "cssvar-accent";
    if (d.cssvarSecondaryCount > 0) return "cssvar-secondary";
    if (d.cssvarCount > 0) return "cssvar";
    if (d.svgCount > 0) return "svg";
    if (d.buttonCount > 0) return "button";
    if (d.footerCount > 0) return "footer";
    if (d.bgCount > 0) return "bg";
    if (d.count > 0 && d.navCount / d.count > 0.5) return "nav";
    return "style";
  }

  const scored: Array<{ value: string; sourceUrl: string; score: number; zone: string }> = [];

  for (const [value, data] of clustered) {
    if (GENERIC_HEX_COLORS.has(value)) continue;

    const hsl = hexToHslTriplet(value);
    if (!hsl) continue;
    const [h, s, l] = hsl;

    if (l < 15) continue;   // near-black: text/dark-nav backgrounds, not brand
    if (l > 91) continue;   // near-white: background noise
    if (s < 10) continue;   // achromatic: UI chrome, not brand

    const { count, svgCount, navCount, buttonCount, footerCount, bgCount, cssvarPrimaryCount, cssvarAccentCount, cssvarSecondaryCount, cssvarCount, sourceUrl } = data;

    // Frequency score using effective (non-nav-dominant) count
    const navPenaltyCount = Math.floor(navCount * 0.6);
    const effectiveCount = Math.max(1, count - navPenaltyCount);
    let score = Math.min(Math.round(Math.log2(effectiveCount + 1) * 10), 38);

    score += Math.round(s * 0.45);          // saturation bonus
    if (l >= 25 && l <= 70) score += 14;    // visible-brand lightness sweet spot
    else if (l > 70 && l <= 82) score += 5; // lighter but still usable
    score += warmHueScore(h, s, l);          // hospitality hue bias

    // CSS custom property bonuses — highest confidence because the developer explicitly
    // named these as brand roles. Override frequency-based signals from generic CSS noise.
    if (cssvarPrimaryCount > 0) score += 65; // --primary/--brand/--e-global-color-primary
    if (cssvarAccentCount > 0) score += 55;  // --accent/--cta/--e-global-color-accent
    if (cssvarSecondaryCount > 0) score += 40; // --secondary/--e-global-color-secondary
    if (cssvarCount > 0) score += 25;        // generic --*color* CSS variable

    // Context bonuses: colors found in brand-defining zones
    if (svgCount > 0) score += 42;    // inline SVG fill/stroke → logo identity color
    if (buttonCount > 0) score += 28; // button/CTA background → designer chose this intentionally
    if (footerCount > 0) score += 16; // footer background/border → brand color confirmation
    if (bgCount > 0) score += 18;     // explicit CSS background-color → deliberate assignment

    // Context penalty: colors that appear predominantly in nav/header are layout chrome
    if (navCount > 0) {
      const navRatio = navCount / count;
      if (navRatio > 0.55) score -= 22;
      else if (navRatio > 0.28) score -= 8;
    }

    scored.push({ value, sourceUrl, score, zone: dominantZone(data) });
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const top = scored.slice(0, 8).map((c) => {
      const hsl = hexToHslTriplet(c.value) ?? [0, 0, 0];
      const data = clustered.get(c.value);
      return `${c.value}(score=${c.score} zone=${c.zone} n=${data?.count ?? 0} cvP=${data?.cssvarPrimaryCount ?? 0} cvA=${data?.cssvarAccentCount ?? 0} cvS=${data?.cssvarSecondaryCount ?? 0} cv=${data?.cssvarCount ?? 0} svg=${data?.svgCount ?? 0} btn=${data?.buttonCount ?? 0} footer=${data?.footerCount ?? 0} bg=${data?.bgCount ?? 0} nav=${data?.navCount ?? 0} H=${hsl[0]} S=${hsl[1]} L=${hsl[2]})`;
    }).join(" | ");
    console.log(`[color-rank] top candidates: ${top}`);
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
