import type { FAQItem, PolicyItem, WidgetThemeSettings } from "@tandem/shared";
import { normalizeWidgetTheme } from "@/lib/widget-theme";
import type { WebsiteImportDraft } from "./types";
import { pickReadableTextColor } from "./utils";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("reserv")) return "Reservations";
  if (lower.includes("cancel")) return "Cancellation";
  if (lower.includes("return")) return "Returns";
  if (lower.includes("ship")) return "Shipping";
  if (lower.includes("policy")) return "Policies";
  return "General";
}

/**
 * Guard against overly dark brand colors slipping through to the widget theme.
 * If a scanned primary is near-black (luminance < 12%), substitute a tasteful
 * deep charcoal (#1E293B) that reads as dark-but-not-black in the chat UI.
 * Warm hues (reds, golds, wines) are preserved regardless of lightness as long
 * as they clear the absolute minimum visibility threshold (L ≥ 8%).
 */
function sanitizeBrandPrimary(hex: string): string {
  // Quick luminance check (same formula as pickReadableTextColor)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance >= 0.08) return hex; // bright enough — keep as-is

  // HSL check: preserve warm-hued darks (deep burgundy, dark gold) as they are
  // intentional brand choices; only soften true neutral darks.
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  const saturation = max === 0 ? 0 : d / max; // HSV saturation proxy
  const lightness = (max + min) / 2;
  const hue = d === 0 ? 0 : max === r / 255 ? ((g - b) / 255) / d : max === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  const hueDeg = ((hue / 6) * 360 + 360) % 360;
  // Warm dark: reds/wines/golds with meaningful saturation — don't touch
  const isWarmDark =
    saturation > 0.25 &&
    lightness < 0.15 &&
    (hueDeg <= 55 || hueDeg >= 270);
  if (isWarmDark) return hex;

  // Neutral dark → substitute a deep slate-charcoal
  return "#1E293B";
}

/**
 * For warm-hued brand primaries (reds, wines, golds), derive a very light warm
 * tinted surface instead of dead white. The tint is ~96% white + 4% primary,
 * giving a subtle warmth that makes the theme feel intentionally designed.
 * Cool primaries (blues, greens) continue to use pure white.
 */
function deriveWarmSurface(primaryHex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(primaryHex)) return "#FFFFFF";
  const r = parseInt(primaryHex.slice(1, 3), 16);
  const g = parseInt(primaryHex.slice(3, 5), 16);
  const b = parseInt(primaryHex.slice(5, 7), 16);

  // Quick hue estimate to filter warm vs cool
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return "#FFFFFF"; // achromatic
  const d = max - min;
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0)
    : max === g ? (b - r) / d + 2
    : (r - g) / d + 4;
  hue = (hue / 6) * 360;

  // Warm: reds/oranges/golds (0-65°) and pinks/wines/purples (270-360°)
  const isWarm = (hue >= 0 && hue <= 65) || hue >= 270;
  if (!isWarm) return "#FFFFFF";

  // Very light warm tint: 4% primary + 96% white
  const tr = Math.min(255, Math.round(r * 0.04 + 255 * 0.96));
  const tg = Math.min(255, Math.round(g * 0.04 + 255 * 0.96));
  const tb = Math.min(255, Math.round(b * 0.04 + 255 * 0.96));
  return `#${tr.toString(16).padStart(2, "0")}${tg.toString(16).padStart(2, "0")}${tb.toString(16).padStart(2, "0")}`.toUpperCase();
}

export function buildThemeFromDraft(draft: WebsiteImportDraft, existing?: Partial<WidgetThemeSettings>): WidgetThemeSettings {
  const rawPrimary = draft.brand.primaryColor.value ?? existing?.primaryColor ?? "#3170FC";
  const primary = rawPrimary.startsWith("#") ? sanitizeBrandPrimary(rawPrimary) : rawPrimary;
  const accent = draft.brand.accentColor.value ?? existing?.accentColor ?? primary;

  // Use the scanned background if present (including white — the swatch panel shows
  // whatever was detected, so preview and apply must honor it exactly).
  // Only fall back to the operator's saved surface or warm derivation when the scan
  // returned nothing at all for the background field.
  const scannedBg = draft.brand.backgroundColor.value;
  const operatorSurface = existing?.surfaceColor;
  const background =
    scannedBg
      ? scannedBg
      : (operatorSurface && operatorSurface !== "#FFFFFF")
        ? operatorSurface
        : deriveWarmSurface(primary);

  const text = draft.brand.textColor.value ?? existing?.textPrimaryColor ?? pickReadableTextColor(background);
  const textSecondary = draft.brand.mutedTextColor?.value ?? existing?.textSecondaryColor ?? "#475569";
  const fontFamily = draft.brand.fontFamily.value ?? existing?.fontFamily ?? "'Inter', sans-serif";

  return normalizeWidgetTheme({
    primaryColor: primary,
    accentColor: accent,
    surfaceColor: background,
    textPrimaryColor: text,
    textSecondaryColor: textSecondary,
    fontFamily,
    logoUrl: draft.brand.logoUrl.value ?? existing?.logoUrl,
    headerBackground: {
      mode: "solid",
      solidColor: primary,
    },
    quickActions: {
      color: accent,
      variant: existing?.quickActions?.variant ?? "solid",
    },
    sendButton: {
      color: accent,
      textColor: pickReadableTextColor(accent),
    },
  });
}

function normalizeExistingTheme(widgetConfig: unknown): Partial<WidgetThemeSettings> {
  if (!isObject(widgetConfig)) {
    return {};
  }

  const rawTheme = isObject(widgetConfig.theme) ? widgetConfig.theme : widgetConfig;
  return rawTheme as Partial<WidgetThemeSettings>;
}

export function buildKnowledgeImportPayload(runId: string, sourceUrl: string, draft: WebsiteImportDraft, nowIso: string) {
  const faqs: FAQItem[] = draft.faqs
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: toCategory(entry.question),
      showInHelp: true,
      updatedAt: nowIso,
    }));

  const policies: PolicyItem[] = draft.policies
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.summary,
      category: toCategory(entry.title),
      showInHelp: true,
      updatedAt: nowIso,
    }));

  const importDocument = {
    runId,
    importedFromUrl: sourceUrl,
    createdAt: nowIso,
    profile: {
      name: draft.businessProfile.name,
      shortDescription: draft.businessProfile.shortDescription,
      phone: draft.businessProfile.phone,
      email: draft.businessProfile.email,
      address: draft.businessProfile.address,
      hours: draft.businessProfile.hours,
      socialLinks: draft.businessProfile.socialLinks,
    },
    faqs,
    policies,
    pageClassification: draft.pageClassification,
    restaurantKnowledge: draft.restaurantKnowledge,
    evidence: draft.evidence,
  };

  return {
    knowledgeConfigPatch: {
      importedSummary: importDocument,
      importedFaqs: faqs,
      importedPolicies: policies,
      structuredWebsiteKnowledge: {
        pageClassification: draft.pageClassification,
        events: draft.restaurantKnowledge.events.filter((entry) => entry.include),
        menuSections: draft.restaurantKnowledge.menuSections.filter((entry) => entry.include),
        reservations: draft.restaurantKnowledge.reservations,
        memberships: draft.restaurantKnowledge.memberships,
      },
      importedInsights: {
        eventHighlights: draft.restaurantInsights?.eventHighlights ?? null,
        reservationGuidance: draft.restaurantInsights?.reservationGuidance ?? null,
        membershipNotes: draft.restaurantInsights?.membershipNotes ?? null,
        menuSummary: draft.restaurantInsights?.menuSummary ?? null,
      },
      contact: {
        phone: draft.businessProfile.phone.value,
        email: draft.businessProfile.email.value,
        address: draft.businessProfile.address.value,
        hours: draft.businessProfile.hours.value,
        socials: draft.businessProfile.socialLinks,
      },
    },
    faqs,
    policies,
  };
}

export function buildApplyPayload(args: {
  runId: string;
  sourceUrl: string;
  draft: WebsiteImportDraft;
  existingWidgetConfig: unknown;
  existingKnowledgeConfig: unknown;
  nowIso: string;
  applyColorScheme?: boolean;
}) {
  const existingTheme = normalizeExistingTheme(args.existingWidgetConfig);
  const theme = args.applyColorScheme !== false
    ? buildThemeFromDraft(args.draft, existingTheme)
    : (isObject(existingTheme) && Object.keys(existingTheme).length
        ? normalizeWidgetTheme(existingTheme as WidgetThemeSettings)
        : buildThemeFromDraft(args.draft, existingTheme));

  const existingWidget = isObject(args.existingWidgetConfig) ? args.existingWidgetConfig : {};
  const existingKnowledge = isObject(args.existingKnowledgeConfig) ? args.existingKnowledgeConfig : {};

  const knowledgePayload = buildKnowledgeImportPayload(args.runId, args.sourceUrl, args.draft, args.nowIso);

  return {
    widgetConfig: {
      ...existingWidget,
      theme,
    },
    knowledgeConfig: {
      ...existingKnowledge,
      ...knowledgePayload.knowledgeConfigPatch,
    },
    theme,
    faqs: knowledgePayload.faqs,
    policies: knowledgePayload.policies,
  };
}
