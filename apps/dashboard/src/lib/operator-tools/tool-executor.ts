/**
 * Operator Tool Executor
 *
 * Executes confirmed operator AI tool calls by directly reading and writing
 * the business_location_configs table in Supabase.
 *
 * CRITICAL: All array mutations (FAQs, contacts) must follow fetch → mutate
 * in-memory → write full array. Partial writes would destroy existing entries.
 *
 * Security: This module performs its own argument validation. Unknown fields
 * are dropped. String lengths are capped. URL fields reject javascript: scheme.
 * The sanitizeKnowledgeConfig constraint is enforced for update_business_info.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FAQItem, ContactMethod, OperatingHoursBlock, ContactMethodType } from "@tandem/shared";
import type { OperatorToolName } from "./tool-definitions";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asString(v: unknown, maxLen = 1000): string {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

function asStringOrUndefined(v: unknown, maxLen = 1000): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.slice(0, maxLen);
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Validate a URL-type string: reject javascript: scheme.
 * Returns the value if valid, throws an error if not.
 */
function validateUrl(value: string): string {
  const trimmed = value.trim();
  if (/^javascript\s*:/i.test(trimmed)) {
    throw new Error("URL with javascript: scheme is not allowed.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Config row types
// ---------------------------------------------------------------------------

type LocationConfigRow = {
  knowledge_config: Record<string, unknown> | null;
  handoff_config: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

async function readLocationConfig(
  supabase: SupabaseClient,
  locationId: string,
): Promise<LocationConfigRow> {
  const { data, error } = await supabase
    .from("business_location_configs")
    .select("knowledge_config, handoff_config")
    .eq("location_id", locationId)
    .maybeSingle<LocationConfigRow>();

  if (error) {
    throw new Error(`Failed to read location config: ${error.message}`);
  }

  return {
    knowledge_config: data?.knowledge_config ?? null,
    handoff_config: data?.handoff_config ?? null,
  };
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

async function writeKnowledgeConfig(
  supabase: SupabaseClient,
  locationId: string,
  existingHandoffConfig: Record<string, unknown> | null,
  newKnowledgeConfig: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("business_location_configs").upsert(
    {
      location_id: locationId,
      knowledge_config: newKnowledgeConfig,
      ...(existingHandoffConfig !== null ? { handoff_config: existingHandoffConfig } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id" },
  );
  if (error) {
    throw new Error(`Failed to write knowledge config: ${error.message}`);
  }
}

async function writeHandoffConfig(
  supabase: SupabaseClient,
  locationId: string,
  existingKnowledgeConfig: Record<string, unknown> | null,
  newHandoffConfig: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("business_location_configs").upsert(
    {
      location_id: locationId,
      handoff_config: newHandoffConfig,
      ...(existingKnowledgeConfig !== null ? { knowledge_config: existingKnowledgeConfig } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id" },
  );
  if (error) {
    throw new Error(`Failed to write handoff config: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Tool executor result type
// ---------------------------------------------------------------------------

export type ToolExecutorResult = {
  updatedConfig: {
    knowledgeConfig?: Record<string, unknown>;
    handoffConfig?: Record<string, unknown>;
  };
  changedFields: string[];
};

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Execute a confirmed operator tool call.
 *
 * @param toolName  - One of the 9 operator tool names.
 * @param toolArgs  - Arguments from the LLM tool call (validated here).
 * @param locationId - The Supabase location UUID (re-resolved from auth in confirm route).
 * @param supabase  - Authenticated Supabase client from the confirm route.
 */
export async function executeOperatorTool(
  toolName: OperatorToolName,
  toolArgs: Record<string, unknown>,
  locationId: string,
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const config = await readLocationConfig(supabase, locationId);
  const existing = {
    knowledge: config.knowledge_config ?? {},
    handoff: config.handoff_config ?? {},
  };

  switch (toolName) {
    case "set_business_hours":
      return executeSetBusinessHours(toolArgs, locationId, existing, supabase);
    case "add_faq":
      return executeAddFaq(toolArgs, locationId, existing, supabase);
    case "update_faq":
      return executeUpdateFaq(toolArgs, locationId, existing, supabase);
    case "remove_faq":
      return executeRemoveFaq(toolArgs, locationId, existing, supabase);
    case "set_handoff_contact":
      return executeSetHandoffContact(toolArgs, locationId, existing, supabase);
    case "remove_handoff_contact":
      return executeRemoveHandoffContact(toolArgs, locationId, existing, supabase);
    case "update_handoff_settings":
      return executeUpdateHandoffSettings(toolArgs, locationId, existing, supabase);
    case "set_behavior_rules":
      return executeSetBehaviorRules(toolArgs, locationId, existing, supabase);
    case "update_business_info":
      return executeUpdateBusinessInfo(toolArgs, locationId, existing, supabase);
    default: {
      const exhaustive: never = toolName;
      throw new Error(`Unknown tool: ${String(exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Individual tool implementations
// ---------------------------------------------------------------------------

async function executeSetBusinessHours(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const hoursNarrative = asString(args.hoursNarrative, 500);
  if (!hoursNarrative) throw new Error("hoursNarrative is required and must be a string.");

  const knowledgeConfig = { ...existing.knowledge };
  // Write narrative into the `structured` key — this is the path hydrateKnowledgeProgram reads.
  const structured = asObject(knowledgeConfig.structured);
  const fields = asObject(structured.fields);

  const updatedStructured = {
    ...structured,
    fields: {
      ...fields,
      hours: hoursNarrative,
    },
  };

  // If structured hoursBlocks are provided, write them to businessProfile.hours
  const rawBlocks = asArray<Record<string, unknown>>(args.hoursBlocks);
  let updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    structured: updatedStructured,
  };

  const changedFields = ["structured.fields.hours"];

  if (rawBlocks.length > 0) {
    const hoursBlocks: OperatingHoursBlock[] = rawBlocks
      .filter(
        (b) =>
          typeof b.label === "string" &&
          Array.isArray(b.days) &&
          typeof b.open === "string" &&
          typeof b.close === "string",
      )
      .map((b) => ({
        id: generateId(),
        label: asString(b.label, 100),
        days: asArray<string>(b.days).filter((d) =>
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(d),
        ),
        open: asString(b.open, 10),
        close: asString(b.close, 10),
      }));

    const businessProfile = asObject(updatedKnowledgeConfig.businessProfile);
    updatedKnowledgeConfig = {
      ...updatedKnowledgeConfig,
      businessProfile: {
        ...businessProfile,
        hours: hoursBlocks,
      },
    };
    changedFields.push("businessProfile.hours");
  }

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields,
  };
}

async function executeAddFaq(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const question = asString(args.question, 300);
  const answer = asString(args.answer, 1000);
  if (!question) throw new Error("question is required and must be a string.");
  if (!answer) throw new Error("answer is required and must be a string.");
  const category = asString(args.category || "general", 100) || "general";

  const knowledgeConfig = { ...existing.knowledge };
  // Read from top-level faqs (the path hydrateKnowledgeProgram reads). Fall back to
  // knowledgeProgram.faqs for backward compat with entries written before this fix.
  const topFaqs: FAQItem[] = asArray<FAQItem>(knowledgeConfig.faqs);
  const legacyFaqs: FAQItem[] = asArray<FAQItem>(asObject(knowledgeConfig.knowledgeProgram).faqs);
  const existingFaqs = topFaqs.length > 0 ? topFaqs : legacyFaqs;

  const newFaq: FAQItem = {
    id: generateId(),
    question,
    answer,
    category,
    showInHelp: true,
    updatedAt: new Date().toISOString(),
  };

  const updatedFaqs: FAQItem[] = [...existingFaqs, newFaq];
  const updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    faqs: updatedFaqs,
    importedFaqs: updatedFaqs,
  };

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields: ["faqs"],
  };
}

async function executeUpdateFaq(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const id = asString(args.id, 200);
  if (!id) throw new Error("id is required and must be a string.");

  const knowledgeConfig = { ...existing.knowledge };
  const topFaqs: FAQItem[] = asArray<FAQItem>(knowledgeConfig.faqs);
  const legacyFaqs: FAQItem[] = asArray<FAQItem>(asObject(knowledgeConfig.knowledgeProgram).faqs);
  const existingFaqs = topFaqs.length > 0 ? topFaqs : legacyFaqs;

  const targetIdx = existingFaqs.findIndex((f) => f.id === id);
  if (targetIdx === -1) {
    throw new Error(`FAQ with id "${id}" not found.`);
  }

  const updatedFaq: FAQItem = { ...existingFaqs[targetIdx] };
  const changedFields: string[] = [];

  const newQuestion = asStringOrUndefined(args.question, 300);
  const newAnswer = asStringOrUndefined(args.answer, 1000);
  const newCategory = asStringOrUndefined(args.category, 100);

  if (newQuestion !== undefined) { updatedFaq.question = newQuestion; changedFields.push("question"); }
  if (newAnswer !== undefined) { updatedFaq.answer = newAnswer; changedFields.push("answer"); }
  if (newCategory !== undefined) { updatedFaq.category = newCategory; changedFields.push("category"); }

  updatedFaq.updatedAt = new Date().toISOString();

  const updatedFaqs: FAQItem[] = existingFaqs.map((f, i) => (i === targetIdx ? updatedFaq : f));
  const updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    faqs: updatedFaqs,
    importedFaqs: updatedFaqs,
  };

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields: changedFields.map((f) => `faqs[id=${id}].${f}`),
  };
}

async function executeRemoveFaq(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const id = asString(args.id, 200);
  if (!id) throw new Error("id is required and must be a string.");

  const knowledgeConfig = { ...existing.knowledge };
  const topFaqs: FAQItem[] = asArray<FAQItem>(knowledgeConfig.faqs);
  const legacyFaqs: FAQItem[] = asArray<FAQItem>(asObject(knowledgeConfig.knowledgeProgram).faqs);
  const existingFaqs = topFaqs.length > 0 ? topFaqs : legacyFaqs;

  const updatedFaqs = existingFaqs.filter((f) => f.id !== id);
  const updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    faqs: updatedFaqs,
    importedFaqs: updatedFaqs,
  };

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields: [`faqs (removed id=${id})`],
  };
}

async function executeSetHandoffContact(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const contactType = asString(args.type, 20);
  const label = asString(args.label, 200);
  const rawValue = asString(args.value, 500);
  const enabled = asBoolean(args.enabled, true);
  const id = asString(args.id, 200);

  const VALID_TYPES: ContactMethodType[] = ["phone", "email", "sms", "link", "form"];
  if (!VALID_TYPES.includes(contactType as ContactMethodType)) {
    throw new Error(`Invalid contact type: "${contactType}". Must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (!label) throw new Error("label is required.");
  if (!rawValue) throw new Error("value is required.");

  // URL-type contacts must not use javascript: scheme
  const value =
    contactType === "link" || contactType === "form"
      ? validateUrl(rawValue)
      : rawValue;

  const handoffConfig = { ...existing.handoff };
  const existingContacts: ContactMethod[] = asArray<ContactMethod>(handoffConfig.contactMethods);

  let updatedContacts: ContactMethod[];

  if (id) {
    // Update existing contact
    const targetIdx = existingContacts.findIndex((c) => c.id === id);
    if (targetIdx === -1) {
      throw new Error(`Contact method with id "${id}" not found.`);
    }
    updatedContacts = existingContacts.map((c, i) =>
      i === targetIdx
        ? { ...c, type: contactType as ContactMethodType, label, value, enabled }
        : c,
    );
  } else {
    // Add new contact
    const newContact: ContactMethod = {
      id: generateId(),
      type: contactType as ContactMethodType,
      label,
      value,
      enabled,
    };
    updatedContacts = [...existingContacts, newContact];
  }

  const updatedHandoffConfig: Record<string, unknown> = {
    ...handoffConfig,
    contactMethods: updatedContacts,
  };

  await writeHandoffConfig(supabase, locationId, existing.knowledge, updatedHandoffConfig);

  return {
    updatedConfig: { handoffConfig: updatedHandoffConfig },
    changedFields: ["handoffConfig.contactMethods"],
  };
}

async function executeRemoveHandoffContact(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const id = asString(args.id, 200);
  if (!id) throw new Error("id is required and must be a string.");

  const handoffConfig = { ...existing.handoff };
  const existingContacts: ContactMethod[] = asArray<ContactMethod>(handoffConfig.contactMethods);

  const updatedContacts = existingContacts.filter((c) => c.id !== id);
  const updatedHandoffConfig: Record<string, unknown> = {
    ...handoffConfig,
    contactMethods: updatedContacts,
  };

  await writeHandoffConfig(supabase, locationId, existing.knowledge, updatedHandoffConfig);

  return {
    updatedConfig: { handoffConfig: updatedHandoffConfig },
    changedFields: [`handoffConfig.contactMethods (removed id=${id})`],
  };
}

async function executeUpdateHandoffSettings(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const handoffConfig = { ...existing.handoff };
  const changedFields: string[] = [];

  const headline = asStringOrUndefined(args.headline, 200);
  const status = typeof args.status === "string" && ["online", "offline"].includes(args.status)
    ? (args.status as "online" | "offline")
    : undefined;
  const statusDetail = asStringOrUndefined(args.statusDetail, 500);
  const supportHoursLabel = asStringOrUndefined(args.supportHoursLabel, 200);
  const offlineMessage = asStringOrUndefined(args.offlineMessage, 500);

  if (headline !== undefined) { handoffConfig.headline = headline; changedFields.push("headline"); }
  if (status !== undefined) { handoffConfig.status = status; changedFields.push("status"); }
  if (statusDetail !== undefined) { handoffConfig.statusDetail = statusDetail; changedFields.push("statusDetail"); }
  if (supportHoursLabel !== undefined) { handoffConfig.supportHoursLabel = supportHoursLabel; changedFields.push("supportHoursLabel"); }
  if (offlineMessage !== undefined) { handoffConfig.offlineMessage = offlineMessage; changedFields.push("offlineMessage"); }

  if (changedFields.length === 0) {
    throw new Error("No valid fields provided for update_handoff_settings.");
  }

  await writeHandoffConfig(supabase, locationId, existing.knowledge, handoffConfig);

  return {
    updatedConfig: { handoffConfig },
    changedFields: changedFields.map((f) => `handoffConfig.${f}`),
  };
}

async function executeSetBehaviorRules(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const knowledgeConfig = { ...existing.knowledge };
  // Write into the `structured` key — the path hydrateKnowledgeProgram reads for training.
  const structured = asObject(knowledgeConfig.structured);
  const existingTraining = asObject(structured.training);

  const toneVoice = asStringOrUndefined(args.toneVoice, 500);
  const shouldAnswer = asStringOrUndefined(args.shouldAnswer, 500);
  const shouldAvoid = asStringOrUndefined(args.shouldAvoid, 500);
  const escalationInstructions = asStringOrUndefined(args.escalationInstructions, 500);
  const conversionGoals =
    Array.isArray(args.conversionGoals)
      ? args.conversionGoals
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.slice(0, 200))
      : undefined;

  const changedFields: string[] = [];
  const updatedTraining = { ...existingTraining };

  if (toneVoice !== undefined) { updatedTraining.toneVoice = toneVoice; changedFields.push("toneVoice"); }
  if (shouldAnswer !== undefined) { updatedTraining.shouldAnswer = shouldAnswer; changedFields.push("shouldAnswer"); }
  if (shouldAvoid !== undefined) { updatedTraining.shouldAvoid = shouldAvoid; changedFields.push("shouldAvoid"); }
  if (escalationInstructions !== undefined) { updatedTraining.escalationInstructions = escalationInstructions; changedFields.push("escalationInstructions"); }
  if (conversionGoals !== undefined) { updatedTraining.conversionGoals = conversionGoals; changedFields.push("conversionGoals"); }

  if (changedFields.length === 0) {
    throw new Error("No valid fields provided for set_behavior_rules.");
  }

  const updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    structured: {
      ...structured,
      training: updatedTraining,
    },
  };

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields: changedFields.map((f) => `structured.training.${f}`),
  };
}

async function executeUpdateBusinessInfo(
  args: Record<string, unknown>,
  locationId: string,
  existing: { knowledge: Record<string, unknown>; handoff: Record<string, unknown> },
  supabase: SupabaseClient,
): Promise<ToolExecutorResult> {
  const knowledgeConfig = { ...existing.knowledge };
  const existingBusinessProfile = asObject(knowledgeConfig.businessProfile);

  // Explicit field-by-field mapping — never spread toolArgs directly.
  // sanitizeKnowledgeConfig constraint: do NOT write locationName or address.
  const businessName = asStringOrUndefined(args.businessName, 200);
  const tagline = asStringOrUndefined(args.tagline, 300);
  const phone = asStringOrUndefined(args.phone, 50);
  const email = asStringOrUndefined(args.email, 200);
  const website =
    typeof args.website === "string"
      ? validateUrl(asString(args.website, 500))
      : undefined;
  const timezone = asStringOrUndefined(args.timezone, 100);

  const changedFields: string[] = [];
  const updatedBusinessProfile = { ...existingBusinessProfile };

  if (businessName !== undefined) { updatedBusinessProfile.businessName = businessName; changedFields.push("businessName"); }
  if (tagline !== undefined) { updatedBusinessProfile.tagline = tagline; changedFields.push("tagline"); }
  if (phone !== undefined) { updatedBusinessProfile.phone = phone; changedFields.push("phone"); }
  if (email !== undefined) { updatedBusinessProfile.email = email; changedFields.push("email"); }
  if (website !== undefined) { updatedBusinessProfile.website = website; changedFields.push("website"); }
  if (timezone !== undefined) { updatedBusinessProfile.timezone = timezone; changedFields.push("timezone"); }

  if (changedFields.length === 0) {
    throw new Error("No valid fields provided for update_business_info.");
  }

  const updatedKnowledgeConfig: Record<string, unknown> = {
    ...knowledgeConfig,
    businessProfile: updatedBusinessProfile,
  };

  await writeKnowledgeConfig(supabase, locationId, existing.handoff, updatedKnowledgeConfig);

  return {
    updatedConfig: { knowledgeConfig: updatedKnowledgeConfig },
    changedFields: changedFields.map((f) => `businessProfile.${f}`),
  };
}
