export const WEBSITE_IMPORT_LIMITS = {
  maxPages: Number(process.env.WEBSITE_IMPORT_MAX_PAGES ?? 22),
  maxChars: 250_000,
  perPageChars: 20_000,
  requestTimeoutMs: 12_000,
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
  return new URL(url).hostname.toLowerCase();
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

const PRIORITY_PATH_HINTS = [
  "contact",
  "about",
  "faq",
  "help",
  "hours",
  "menu",
  "reservation",
  "booking",
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
