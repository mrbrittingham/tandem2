/**
 * Operator AI Tool Definitions
 *
 * Defines the 9 operator tools using the Vercel AI SDK `tool` helper.
 * Tools are passed to generateText in the operator-chat route.
 *
 * The PendingChange type is also exported here for use across the
 * confirmation flow (route → sidebar → renderer → confirm route).
 */
import { tool, jsonSchema } from "ai";

// ---------------------------------------------------------------------------
// PendingChange — the server-issued object describing a proposed config write
// ---------------------------------------------------------------------------

/**
 * A proposed configuration change returned by /api/operator-chat when a
 * tool call is detected. The client echoes this back to /api/operator-chat/confirm
 * to execute. locationId, businessId, and locationSlug are resolved server-side
 * and must never be supplied by the client.
 */
export type PendingChange = {
  type: "pending_change";
  toolName: string;
  toolArgs: Record<string, unknown>;
  humanSummary: string;
  /** Resolved from authenticated session — not client-supplied. */
  locationId: string;
  locationSlug: string;
  businessId: string;
};

// ---------------------------------------------------------------------------
// The 9 operator tools
// ---------------------------------------------------------------------------

export const operatorTools = {
  set_business_hours: tool({
    description:
      "Replace the restaurant's operating hours schedule. Update both the free-text narrative description for the chatbot and the optional structured hours blocks.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        hoursNarrative: {
          type: "string",
          description:
            "Free-text description of hours for chatbot knowledge (e.g. 'Mon-Fri 11am-10pm, Sat-Sun 10am-11pm'). Max 500 chars.",
        },
        hoursBlocks: {
          type: "array",
          description: "Structured schedule entries. Each entry covers one contiguous time block.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              days: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                },
              },
              open: { type: "string", description: "Opening time in HH:MM 24-hour format" },
              close: { type: "string", description: "Closing time in HH:MM 24-hour format" },
            },
            required: ["label", "days", "open", "close"],
          },
        },
      },
      required: ["hoursNarrative"],
    }),
  }),

  add_faq: tool({
    description: "Add a new FAQ entry to the chatbot's knowledge base.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The question as it would appear in the chatbot. Max 300 chars.",
        },
        answer: {
          type: "string",
          description: "The answer the chatbot should give. Max 1000 chars.",
        },
        category: {
          type: "string",
          description:
            "Grouping label e.g. 'hours', 'reservations', 'menu', 'general'. Defaults to 'general'.",
        },
      },
      required: ["question", "answer"],
    }),
  }),

  update_faq: tool({
    description:
      "Edit the question or answer text of an existing FAQ entry by ID. Only the supplied fields are changed.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the existing FAQ to update." },
        question: { type: "string", description: "New question text. Omit to leave unchanged." },
        answer: { type: "string", description: "New answer text. Omit to leave unchanged." },
        category: { type: "string", description: "New category. Omit to leave unchanged." },
      },
      required: ["id"],
    }),
  }),

  remove_faq: tool({
    description: "Delete an FAQ entry from the chatbot's knowledge base by its ID.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the FAQ entry to delete." },
      },
      required: ["id"],
    }),
  }),

  set_handoff_contact: tool({
    description:
      "Add a new handoff contact method or update an existing one. Used for phone numbers, email addresses, booking links, and forms.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "ID of existing contact to update. Omit to add a new contact.",
        },
        type: {
          type: "string",
          enum: ["phone", "email", "sms", "link", "form"],
        },
        label: {
          type: "string",
          description: "Display label e.g. 'Front desk', 'Email us'",
        },
        value: {
          type: "string",
          description: "Phone number, email address, or URL",
        },
        enabled: {
          type: "boolean",
          description: "Whether this contact is shown to guests. Defaults to true.",
        },
      },
      required: ["type", "label", "value"],
    }),
  }),

  remove_handoff_contact: tool({
    description: "Remove a handoff contact method by its ID.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the contact method to remove." },
      },
      required: ["id"],
    }),
  }),

  update_handoff_settings: tool({
    description:
      "Update the handoff panel headline, online/offline status, status detail text, support hours label, and offline message. All fields are optional — only supplied fields are changed.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        headline: {
          type: "string",
          description: "Heading shown in the handoff panel e.g. 'Need more help?'",
        },
        status: {
          type: "string",
          enum: ["online", "offline"],
        },
        statusDetail: {
          type: "string",
          description: "Detail text shown next to the status badge.",
        },
        supportHoursLabel: {
          type: "string",
          description: "Text describing when staff are available e.g. 'Mon-Fri 10am-6pm'",
        },
        offlineMessage: {
          type: "string",
          description: "Message shown to guests when status is offline.",
        },
      },
    }),
  }),

  set_behavior_rules: tool({
    description:
      "Update the AI assistant's tone/voice guidelines, what it should answer, what it should avoid, escalation instructions, and conversion goals. All fields are optional.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        toneVoice: {
          type: "string",
          description: "Describe the chatbot's personality and speaking style.",
        },
        shouldAnswer: {
          type: "string",
          description: "Topics and question types the chatbot should always try to answer.",
        },
        shouldAvoid: {
          type: "string",
          description: "Topics the chatbot should decline or redirect.",
        },
        escalationInstructions: {
          type: "string",
          description: "When and how to hand off to a human.",
        },
        conversionGoals: {
          type: "array",
          items: { type: "string" },
          description:
            "Business goals to weave into responses e.g. 'promote reservations', 'encourage online ordering'.",
        },
      },
    }),
  }),

  update_business_info: tool({
    description:
      "Update basic business details: display name, tagline, phone, email, website URL, timezone. All fields are optional.",
    inputSchema: jsonSchema({
      type: "object" as const,
      properties: {
        businessName: { type: "string", description: "Display name of the restaurant." },
        tagline: { type: "string", description: "Short brand tagline." },
        phone: { type: "string", description: "Primary phone number." },
        email: { type: "string", description: "Primary business email." },
        website: { type: "string", description: "Website URL." },
        timezone: {
          type: "string",
          description: "IANA timezone string e.g. 'America/New_York'.",
        },
      },
    }),
  }),
} as const;

export type OperatorToolName = keyof typeof operatorTools;

export const OPERATOR_TOOL_NAMES: readonly OperatorToolName[] = [
  "set_business_hours",
  "add_faq",
  "update_faq",
  "remove_faq",
  "set_handoff_contact",
  "remove_handoff_contact",
  "update_handoff_settings",
  "set_behavior_rules",
  "update_business_info",
] as const;

// ---------------------------------------------------------------------------
// Human summary generator — produces the humanSummary field for PendingChange
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function generateHumanSummary(
  toolName: string,
  toolArgs: Record<string, unknown>,
): string {
  switch (toolName as OperatorToolName) {
    case "set_business_hours": {
      const narrative = asStr(toolArgs.hoursNarrative);
      const preview = narrative.length > 100 ? `${narrative.slice(0, 97)}…` : narrative;
      return `Set business hours: "${preview}"`;
    }
    case "add_faq": {
      const q = asStr(toolArgs.question);
      const a = asStr(toolArgs.answer);
      const qp = q.length > 80 ? `${q.slice(0, 77)}…` : q;
      const ap = a.length > 80 ? `${a.slice(0, 77)}…` : a;
      return `Add FAQ: "${qp}" → "${ap}"`;
    }
    case "update_faq": {
      const id = asStr(toolArgs.id);
      const changed = (["question", "answer", "category"] as const)
        .filter((k) => toolArgs[k] !== undefined)
        .join(", ");
      return `Update FAQ (id: ${id})${changed ? `: change ${changed}` : ""}`;
    }
    case "remove_faq": {
      return `Remove FAQ (id: ${asStr(toolArgs.id)})`;
    }
    case "set_handoff_contact": {
      const contactType = asStr(toolArgs.type);
      const label = asStr(toolArgs.label);
      const value = asStr(toolArgs.value);
      const id = asStr(toolArgs.id);
      return id
        ? `Update ${contactType} contact "${label}": ${value}`
        : `Add ${contactType} contact "${label}": ${value}`;
    }
    case "remove_handoff_contact": {
      return `Remove handoff contact (id: ${asStr(toolArgs.id)})`;
    }
    case "update_handoff_settings": {
      const fields = Object.keys(toolArgs).filter((k) => toolArgs[k] !== undefined);
      return `Update handoff settings: ${fields.join(", ")}`;
    }
    case "set_behavior_rules": {
      const fields = Object.keys(toolArgs).filter((k) => toolArgs[k] !== undefined);
      return `Update behavior rules: ${fields.join(", ")}`;
    }
    case "update_business_info": {
      const fields = Object.keys(toolArgs).filter((k) => toolArgs[k] !== undefined);
      return `Update business info: ${fields.join(", ")}`;
    }
    default:
      return `Execute ${toolName}`;
  }
}
