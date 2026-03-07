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

function buildThemeFromDraft(draft: WebsiteImportDraft, existing?: Partial<WidgetThemeSettings>): WidgetThemeSettings {
  const primary = draft.brand.primaryColor.value ?? existing?.primaryColor ?? "#3170FC";
  const accent = draft.brand.accentColor.value ?? existing?.accentColor ?? primary;
  const background = draft.brand.backgroundColor.value ?? existing?.surfaceColor ?? "#FFFFFF";
  const text = draft.brand.textColor.value ?? existing?.textPrimaryColor ?? pickReadableTextColor(background);
  const textSecondary = existing?.textSecondaryColor ?? "#475569";
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
}) {
  const existingTheme = normalizeExistingTheme(args.existingWidgetConfig);
  const theme = buildThemeFromDraft(args.draft, existingTheme);

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
