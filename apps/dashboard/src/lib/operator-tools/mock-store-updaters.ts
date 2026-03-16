/**
 * Mock Store Updaters for Operator AI Tool Confirmations
 *
 * After a confirmed operator AI tool write, the mock store (localStorage) must
 * be updated so that dashboard pages that read from the mock store reflect the
 * new state immediately — without a page reload.
 *
 * These helpers are called from ConsoleSidebar.tsx after a successful
 * /api/operator-chat/confirm response.
 *
 * Each helper performs a targeted mutation — never a full spread of toolArgs.
 * New fields that don't belong in BusinessProfile are silently ignored so that
 * server-side data not represented in the mock store doesn't corrupt local state.
 */

import type { BusinessProfile, FAQItem, ContactMethod, OperatingHoursBlock, ContactMethodType } from "@tandem/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asString(v: unknown, maxLen = 1000): string {
  return typeof v === "string" ? v.slice(0, maxLen) : "";
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Hours change
// ---------------------------------------------------------------------------

/**
 * Apply set_business_hours args to the mock-store BusinessProfile.
 * Updates profile.hours with structured blocks if provided.
 */
export function applyHoursChange(
  profile: BusinessProfile,
  toolArgs: Record<string, unknown>,
): BusinessProfile {
  const next = { ...profile };

  const rawBlocks = toolArgs.hoursBlocks;
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    const VALID_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hoursBlocks: OperatingHoursBlock[] = (rawBlocks as Record<string, unknown>[])
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
        days: (b.days as unknown[]).filter(
          (d): d is string => typeof d === "string" && VALID_DAYS.includes(d),
        ),
        open: asString(b.open, 10),
        close: asString(b.close, 10),
      }));
    next.hours = hoursBlocks;
  }

  return next;
}

// ---------------------------------------------------------------------------
// FAQ changes
// ---------------------------------------------------------------------------

/**
 * Apply add_faq, update_faq, or remove_faq args to the mock-store BusinessProfile.
 */
export function applyFaqChange(
  profile: BusinessProfile,
  toolArgs: Record<string, unknown>,
  toolName: "add_faq" | "update_faq" | "remove_faq",
): BusinessProfile {
  const next = { ...profile, faqs: [...profile.faqs] };

  switch (toolName) {
    case "add_faq": {
      const newFaq: FAQItem = {
        id: generateId(),
        question: asString(toolArgs.question, 300),
        answer: asString(toolArgs.answer, 1000),
        category: asString(toolArgs.category || "general", 100) || "general",
        showInHelp: true,
        updatedAt: new Date().toISOString(),
      };
      next.faqs = [...next.faqs, newFaq];
      break;
    }
    case "update_faq": {
      const id = asString(toolArgs.id);
      next.faqs = next.faqs.map((faq) => {
        if (faq.id !== id) return faq;
        const updated = { ...faq, updatedAt: new Date().toISOString() };
        if (typeof toolArgs.question === "string") updated.question = asString(toolArgs.question, 300);
        if (typeof toolArgs.answer === "string") updated.answer = asString(toolArgs.answer, 1000);
        if (typeof toolArgs.category === "string") updated.category = asString(toolArgs.category, 100);
        return updated;
      });
      break;
    }
    case "remove_faq": {
      const id = asString(toolArgs.id);
      next.faqs = next.faqs.filter((faq) => faq.id !== id);
      break;
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// Handoff changes
// ---------------------------------------------------------------------------

const VALID_CONTACT_TYPES: ContactMethodType[] = ["phone", "email", "sms", "link", "form"];

/**
 * Apply set_handoff_contact, remove_handoff_contact, or update_handoff_settings
 * args to the mock-store BusinessProfile.
 */
export function applyHandoffChange(
  profile: BusinessProfile,
  toolArgs: Record<string, unknown>,
  toolName: "set_handoff_contact" | "remove_handoff_contact" | "update_handoff_settings",
): BusinessProfile {
  const next = { ...profile, handoff: { ...profile.handoff } };

  switch (toolName) {
    case "set_handoff_contact": {
      const existingContacts: ContactMethod[] = [...(next.handoff.contactMethods ?? [])];
      const id = asString(toolArgs.id);
      const contactType = asString(toolArgs.type, 20);
      const label = asString(toolArgs.label, 200);
      const value = asString(toolArgs.value, 500);
      const enabled = asBoolean(toolArgs.enabled, true);

      if (!VALID_CONTACT_TYPES.includes(contactType as ContactMethodType)) break;

      if (id) {
        next.handoff.contactMethods = existingContacts.map((c) =>
          c.id === id
            ? { ...c, type: contactType as ContactMethodType, label, value, enabled }
            : c,
        );
      } else {
        const newContact: ContactMethod = {
          id: generateId(),
          type: contactType as ContactMethodType,
          label,
          value,
          enabled,
        };
        next.handoff.contactMethods = [...existingContacts, newContact];
      }
      break;
    }
    case "remove_handoff_contact": {
      const id = asString(toolArgs.id);
      next.handoff.contactMethods = (next.handoff.contactMethods ?? []).filter(
        (c) => c.id !== id,
      );
      break;
    }
    case "update_handoff_settings": {
      if (typeof toolArgs.headline === "string") next.handoff.headline = asString(toolArgs.headline, 200);
      if (toolArgs.status === "online" || toolArgs.status === "offline") next.handoff.status = toolArgs.status;
      if (typeof toolArgs.statusDetail === "string") next.handoff.statusDetail = asString(toolArgs.statusDetail, 500);
      if (typeof toolArgs.supportHoursLabel === "string") next.handoff.supportHoursLabel = asString(toolArgs.supportHoursLabel, 200);
      if (typeof toolArgs.offlineMessage === "string") next.handoff.offlineMessage = asString(toolArgs.offlineMessage, 500);
      break;
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// Behavior rules
// ---------------------------------------------------------------------------

/**
 * Apply set_behavior_rules args to the mock-store BusinessProfile.
 * The mock-store BusinessProfile doesn't have a direct training field,
 * so this is a no-op at the mock-store level — the config-store invalidation
 * via notifyConfigUpdated() causes a re-fetch from the server for pages that
 * display training settings. This helper exists for completeness.
 */
export function applyBehaviorChange(
  profile: BusinessProfile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _toolArgs: Record<string, unknown>,
): BusinessProfile {
  // BusinessProfile in mock-store has no training field.
  // The config-store notifyConfigUpdated() handles the UI refresh.
  return profile;
}

// ---------------------------------------------------------------------------
// Business info
// ---------------------------------------------------------------------------

/**
 * Apply update_business_info args to the mock-store BusinessProfile.
 * Never writes locationName or address (sanitizeKnowledgeConfig constraint).
 */
export function applyBusinessInfoChange(
  profile: BusinessProfile,
  toolArgs: Record<string, unknown>,
): BusinessProfile {
  const next = { ...profile };

  // Explicit field mapping — never spread toolArgs
  if (typeof toolArgs.businessName === "string") {
    next.businessName = asString(toolArgs.businessName, 200);
    next.name = next.businessName;
  }
  if (typeof toolArgs.tagline === "string") {
    next.tagline = asString(toolArgs.tagline, 300);
  }

  return next;
}
