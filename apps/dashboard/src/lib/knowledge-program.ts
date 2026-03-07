import type { BusinessProfile, FAQItem, PolicyItem } from "@tandem/shared";

export type AssistantTrainingControls = {
  toneVoice: string;
  shouldAnswer: string;
  shouldAvoid: string;
  escalationInstructions: string;
  conversionGoals: string[];
};

export type RestaurantKnowledgeFields = {
  businessOverview: string;
  cuisineServiceStyle: string;
  hours: string;
  locationDetails: string;
  reservationsGuidance: string;
  menuHighlights: string;
  menuAssetUrls: string[];
  dietaryAllergyNotes: string;
  privateEvents: string;
  recurringEvents: string;
  upcomingEvents: string;
  memberships: string;
  policiesSummary: string;
  parkingAccessibility: string;
  seasonalSpecials: string;
};

export type KnowledgeProgram = {
  setupPrompt: string;
  fields: RestaurantKnowledgeFields;
  training: AssistantTrainingControls;
  uploadedSources: Array<{
    id: string;
    label: string;
    url: string;
    kind: "menu" | "events" | "policies" | "faq" | "other";
  }>;
  faqs: FAQItem[];
  policies: PolicyItem[];
  importedInsights: {
    eventHighlights?: string;
    reservationGuidance?: string;
    membershipNotes?: string;
    menuSummary?: string;
  };
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function buildKnowledgeProgramFromBusiness(business: BusinessProfile): KnowledgeProgram {
  const existingHours = business.hours
    .map((entry) => `${entry.label}: ${entry.days.join(", ")} ${entry.open}-${entry.close}`)
    .join(" | ");

  return {
    setupPrompt: "",
    fields: {
      businessOverview: business.summary ?? "",
      cuisineServiceStyle: business.tagline ?? "",
      hours: existingHours || business.handoff.supportHoursLabel || "",
      locationDetails: business.location ?? "",
      reservationsGuidance: "",
      menuHighlights: "",
      menuAssetUrls: [],
      dietaryAllergyNotes: "",
      privateEvents: "",
      recurringEvents: "",
      upcomingEvents: "",
      memberships: "",
      policiesSummary: business.policies.map((entry) => `${entry.title}: ${entry.description}`).join("\n"),
      parkingAccessibility: "",
      seasonalSpecials: "",
    },
    training: {
      toneVoice: "Warm, clear, and proactive.",
      shouldAnswer: "Hours, menu, reservations, events, policies, location details, and accessibility guidance.",
      shouldAvoid: "Medical or legal advice, private customer data, and unavailable promotions.",
      escalationInstructions: business.handoff.offlineMessage || "Escalate booking edge cases, complaints, and urgent support requests.",
      conversionGoals: ["Book a table", "Call location", "Visit events page"],
    },
    uploadedSources: [],
    faqs: business.faqs.map((entry) => ({ ...entry })),
    policies: business.policies.map((entry) => ({ ...entry })),
    importedInsights: {},
  };
}

export function hydrateKnowledgeProgram(value: unknown, fallback: KnowledgeProgram): KnowledgeProgram {
  const root = asObject(value);
  const structured = asObject(root.structured);
  const fields = asObject(structured.fields);
  const training = asObject(structured.training);
  const uploadedSources = Array.isArray(structured.uploadedSources) ? structured.uploadedSources : [];
  const importedInsights = asObject(root.importedInsights);

  return {
    setupPrompt: asString(structured.setupPrompt) || fallback.setupPrompt,
    fields: {
      businessOverview: asString(fields.businessOverview) || fallback.fields.businessOverview,
      cuisineServiceStyle: asString(fields.cuisineServiceStyle) || fallback.fields.cuisineServiceStyle,
      hours: asString(fields.hours) || fallback.fields.hours,
      locationDetails: asString(fields.locationDetails) || fallback.fields.locationDetails,
      reservationsGuidance: asString(fields.reservationsGuidance) || fallback.fields.reservationsGuidance,
      menuHighlights: asString(fields.menuHighlights) || fallback.fields.menuHighlights,
      menuAssetUrls: asStringArray(fields.menuAssetUrls),
      dietaryAllergyNotes: asString(fields.dietaryAllergyNotes) || fallback.fields.dietaryAllergyNotes,
      privateEvents: asString(fields.privateEvents) || fallback.fields.privateEvents,
      recurringEvents: asString(fields.recurringEvents) || fallback.fields.recurringEvents,
      upcomingEvents: asString(fields.upcomingEvents) || fallback.fields.upcomingEvents,
      memberships: asString(fields.memberships) || fallback.fields.memberships,
      policiesSummary: asString(fields.policiesSummary) || fallback.fields.policiesSummary,
      parkingAccessibility: asString(fields.parkingAccessibility) || fallback.fields.parkingAccessibility,
      seasonalSpecials: asString(fields.seasonalSpecials) || fallback.fields.seasonalSpecials,
    },
    training: {
      toneVoice: asString(training.toneVoice) || fallback.training.toneVoice,
      shouldAnswer: asString(training.shouldAnswer) || fallback.training.shouldAnswer,
      shouldAvoid: asString(training.shouldAvoid) || fallback.training.shouldAvoid,
      escalationInstructions: asString(training.escalationInstructions) || fallback.training.escalationInstructions,
      conversionGoals: asStringArray(training.conversionGoals).length
        ? asStringArray(training.conversionGoals)
        : fallback.training.conversionGoals,
    },
    uploadedSources: uploadedSources
      .map((entry) => {
        const object = asObject(entry);
        const label = asString(object.label);
        const url = asString(object.url);
        if (!label || !url) {
          return null;
        }
        const kindValue = asString(object.kind);
        const kind = kindValue === "menu" || kindValue === "events" || kindValue === "policies" || kindValue === "faq"
          ? kindValue
          : "other";
        return {
          id: asString(object.id) || `src-${slug(`${label}-${url}`)}`,
          label,
          url,
          kind,
        };
      })
      .filter((entry): entry is KnowledgeProgram["uploadedSources"][number] => Boolean(entry)),
    faqs: Array.isArray(root.faqs) ? (root.faqs as FAQItem[]) : fallback.faqs,
    policies: Array.isArray(root.policies) ? (root.policies as PolicyItem[]) : fallback.policies,
    importedInsights: {
      eventHighlights: asString(importedInsights.eventHighlights) || undefined,
      reservationGuidance: asString(importedInsights.reservationGuidance) || undefined,
      membershipNotes: asString(importedInsights.membershipNotes) || undefined,
      menuSummary: asString(importedInsights.menuSummary) || undefined,
    },
  };
}

export function toKnowledgeConfig(program: KnowledgeProgram) {
  return {
    structured: {
      setupPrompt: program.setupPrompt,
      fields: program.fields,
      training: program.training,
      uploadedSources: program.uploadedSources,
    },
    faqs: program.faqs,
    policies: program.policies,
    importedFaqs: program.faqs,
    importedPolicies: program.policies,
    importedInsights: program.importedInsights,
  };
}

function sentenceChunks(input: string): string[] {
  return input
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 12);
}

export function applyAiSetupPrompt(current: KnowledgeProgram, prompt: string): KnowledgeProgram {
  const normalized = prompt.trim();
  if (!normalized) {
    return current;
  }

  const lower = normalized.toLowerCase();
  const sentences = sentenceChunks(normalized);
  const firstTwo = sentences.slice(0, 2).join(" ");

  const conversionGoals = new Set(current.training.conversionGoals);
  if (/reserv|book|table/.test(lower)) conversionGoals.add("Book a table");
  if (/call|phone/.test(lower)) conversionGoals.add("Call location");
  if (/event|music|live|festival|tasting/.test(lower)) conversionGoals.add("Promote events");
  if (/order|delivery|takeout/.test(lower)) conversionGoals.add("Drive online orders");
  if (/wine club|membership|club/.test(lower)) conversionGoals.add("Grow memberships");

  const nextFaqs = [...current.faqs];
  if (/event|live music|weekend/.test(lower)) {
    nextFaqs.push({
      id: crypto.randomUUID(),
      question: "What events are coming up this week?",
      answer: "Share upcoming events with dates and include the booking link when available.",
      category: "Events",
      showInHelp: true,
      updatedAt: new Date().toISOString(),
    });
  }
  if (/reservation|book/.test(lower)) {
    nextFaqs.push({
      id: crypto.randomUUID(),
      question: "How do I reserve a table?",
      answer: "Explain booking channels, availability windows, and waitlist guidance.",
      category: "Reservations",
      showInHelp: true,
      updatedAt: new Date().toISOString(),
    });
  }

  const dedupedFaqs = nextFaqs.filter((entry, index, list) => list.findIndex((candidate) => candidate.question === entry.question) === index);

  return {
    ...current,
    setupPrompt: normalized,
    fields: {
      ...current.fields,
      businessOverview: firstTwo || current.fields.businessOverview,
      cuisineServiceStyle: /winery|wine/.test(lower)
        ? "Winery restaurant experience with guided tastings and hospitality-led service."
        : current.fields.cuisineServiceStyle || "Restaurant service focused on hospitality and clear recommendations.",
      reservationsGuidance: /reserv|book|table/.test(lower)
        ? "Prioritize reservation help, explain booking options, and offer waitlist alternatives when full."
        : current.fields.reservationsGuidance,
      upcomingEvents: /event|live music|weekend|seasonal/.test(lower)
        ? (sentences.find((entry) => /event|music|weekend|seasonal/i.test(entry)) ?? current.fields.upcomingEvents)
        : current.fields.upcomingEvents,
      memberships: /wine club|membership|club/.test(lower)
        ? "Include membership benefits, pickup details, and renewal timing in relevant responses."
        : current.fields.memberships,
      seasonalSpecials: /seasonal|holiday/.test(lower)
        ? (sentences.find((entry) => /seasonal|holiday/i.test(entry)) ?? current.fields.seasonalSpecials)
        : current.fields.seasonalSpecials,
    },
    training: {
      ...current.training,
      toneVoice: /friendly|warm|welcoming/.test(lower)
        ? "Warm, conversational, and confident."
        : current.training.toneVoice,
      conversionGoals: Array.from(conversionGoals.values()),
    },
    faqs: dedupedFaqs,
  };
}
