/**
 * Onboarding state machine for the Tandem 3.0 staged onboarding flow.
 * No UI dependencies — pure state logic only.
 */

import type { CrawledPage, WebsiteImportDraft } from "@/lib/website-import/types";

// ── Stage definitions ─────────────────────────────────────────────────────────

export type OnboardingStage =
  | "business-form"   // Stage 0: collect business + location info
  | "website-url"     // Stage 1: collect website URL
  | "scanning"        // Stage 2: import in progress (polling)
  | "scan-results"    // Stage 3: narrate what was found
  | "scan-review"     // Stage 3b: optional detailed review
  | "manual-setup"    // Stage 4: form-based fallback (scan failed/skipped)
  | "handoff"         // Stage 5: handoff contact setup
  | "complete";       // Stage 6: completion + widget preview

// ── Data models ───────────────────────────────────────────────────────────────

export type LocationData = {
  id: string;
  businessId: string;  // = business slug
  slug: string;        // = location slug
  name: string;
};

export type BusinessData = {
  name: string;
  slug: string; // derived from name, used as businessId
};

export type ScanError = {
  code: string | null;
  message: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  /** Embed a special interactive widget inside this message. */
  embed?: "url-input" | "handoff-input";
  /** Progressive status lines appended to this message during scanning. */
  statusLines?: string[];
};

// ── State ─────────────────────────────────────────────────────────────────────

export type OnboardingState = {
  stage: OnboardingStage;
  businessData: BusinessData | null;
  locationData: LocationData | null;
  runId: string | null;
  scanUrl: string | null;
  scanPages: CrawledPage[];
  scanDraft: WebsiteImportDraft | null;
  scanError: ScanError | null;
  chatMessages: ChatMessage[];
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type OnboardingAction =
  | {
      type: "BUSINESS_CREATED";
      businessData: BusinessData;
      locationData: LocationData;
    }
  | {
      type: "SCAN_STARTED";
      runId: string;
      url: string;
    }
  | {
      type: "SCAN_PAGES_UPDATED";
      pages: CrawledPage[];
    }
  | {
      type: "SCAN_SUCCEEDED";
      draft: WebsiteImportDraft;
    }
  | {
      type: "SCAN_FAILED";
      error: ScanError;
    }
  | { type: "REVIEW_DRAFT" }
  | { type: "APPLY_DRAFT" }
  | { type: "SKIP_SCAN" }
  | { type: "RETRY_URL" }
  | { type: "HANDOFF_SAVED" }
  | { type: "HANDOFF_SKIPPED" }
  | { type: "APPEND_CHAT_MESSAGES"; messages: ChatMessage[] }
  | { type: "ADD_STATUS_LINE"; messageId: string; line: string };

// ── Initial state ─────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to Tandem! I'm your restaurant AI assistant.\n\nI'll help you set up a chatbot that knows your menu, hours, and how to handle guest questions — all in the next few minutes.\n\nFirst, let's get a few basics so I know your restaurant.",
};

const WEBSITE_URL_MESSAGE: ChatMessage = {
  id: "website-url-prompt",
  role: "assistant",
  content:
    "Great — your restaurant is all set!\n\nNow, do you have a restaurant website? If you paste the URL, I can scan it to automatically learn your hours, menu, FAQs, and contact info.\n\nThis usually takes about 30–60 seconds and saves you a lot of setup time.",
  embed: "url-input",
};

const MANUAL_SETUP_MESSAGE: ChatMessage = {
  id: "manual-setup-intro",
  role: "assistant",
  content:
    "No problem — we can set things up manually. You can enter key details below and I'll add them to your chatbot's knowledge base.\n\nOnce you're done, we'll move on to configuring your team's contact information.",
};

const HANDOFF_MESSAGE: ChatMessage = {
  id: "handoff-prompt",
  role: "assistant",
  content:
    "Almost done! One last thing — when a guest needs to speak to someone on your team, where should the chatbot send them?\n\nThis is the \"Get more help\" button they'll see in the chat widget.",
  embed: "handoff-input",
};

export const initialOnboardingState: OnboardingState = {
  stage: "business-form",
  businessData: null,
  locationData: null,
  runId: null,
  scanUrl: null,
  scanPages: [],
  scanDraft: null,
  scanError: null,
  chatMessages: [WELCOME_MESSAGE],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "BUSINESS_CREATED": {
      const websiteUrlMsg = {
        ...WEBSITE_URL_MESSAGE,
        content: WEBSITE_URL_MESSAGE.content.replace(
          "Great — your restaurant is all set!",
          `Great, ${action.locationData.name} is all set!`,
        ),
      };
      return {
        ...state,
        stage: "website-url",
        businessData: action.businessData,
        locationData: action.locationData,
        chatMessages: [...state.chatMessages, websiteUrlMsg],
      };
    }

    case "SCAN_STARTED": {
      const domain = extractDomain(action.url);
      const scanningMsg: ChatMessage = {
        id: `scanning-${generateId()}`,
        role: "assistant",
        content: `Scanning ${domain} now. I'll let you know what I find...`,
        statusLines: [],
      };
      return {
        ...state,
        stage: "scanning",
        runId: action.runId,
        scanUrl: action.url,
        scanPages: [],
        scanError: null,
        chatMessages: [...state.chatMessages, scanningMsg],
      };
    }

    case "SCAN_PAGES_UPDATED": {
      return {
        ...state,
        scanPages: action.pages,
      };
    }

    case "SCAN_SUCCEEDED": {
      const draft = action.draft;
      const resultsMsg = buildScanResultsMessage(draft, generateId());
      return {
        ...state,
        stage: "scan-results",
        scanDraft: draft,
        chatMessages: [...state.chatMessages, resultsMsg],
      };
    }

    case "SCAN_FAILED": {
      const errMsg = buildScanErrorMessage(action.error, generateId(), state.scanUrl);
      const newStage = getScanFailureStage(action.error.code);
      const nextMessages =
        newStage === "website-url"
          ? [
              ...state.chatMessages,
              errMsg,
              {
                ...WEBSITE_URL_MESSAGE,
                id: `retry-url-${generateId()}`,
              },
            ]
          : [...state.chatMessages, errMsg, MANUAL_SETUP_MESSAGE];

      return {
        ...state,
        stage: newStage,
        scanError: action.error,
        chatMessages: nextMessages,
      };
    }

    case "REVIEW_DRAFT": {
      return { ...state, stage: "scan-review" };
    }

    case "APPLY_DRAFT": {
      const handoffMsg = buildHandoffMessage(state.scanDraft, generateId());
      return {
        ...state,
        stage: "handoff",
        chatMessages: [...state.chatMessages, handoffMsg],
      };
    }

    case "SKIP_SCAN": {
      return {
        ...state,
        stage: "manual-setup",
        chatMessages: [...state.chatMessages, MANUAL_SETUP_MESSAGE],
      };
    }

    case "RETRY_URL": {
      const retryMsg = {
        ...WEBSITE_URL_MESSAGE,
        id: `retry-url-${generateId()}`,
        content:
          "No problem — give it another try. Paste your website URL below and I'll scan it again.",
      };
      return {
        ...state,
        stage: "website-url",
        scanError: null,
        chatMessages: [...state.chatMessages, retryMsg],
      };
    }

    case "HANDOFF_SAVED": {
      const completeMsg: ChatMessage = {
        id: `complete-${generateId()}`,
        role: "assistant",
        content:
          "Your chatbot is ready! I've added your contact information so guests can reach your team.\n\nThe preview on the right shows exactly what your guests will see. You can always update anything from your dashboard.\n\nLet's take a look at your new dashboard.",
      };
      return {
        ...state,
        stage: "complete",
        chatMessages: [...state.chatMessages, completeMsg],
      };
    }

    case "HANDOFF_SKIPPED": {
      const completeMsg: ChatMessage = {
        id: `complete-skip-${generateId()}`,
        role: "assistant",
        content:
          "Your chatbot is ready! You can add a contact method anytime from your dashboard.\n\nThe preview on the right shows exactly what your guests will see.\n\nLet's take a look at your new dashboard.",
      };
      return {
        ...state,
        stage: "complete",
        chatMessages: [...state.chatMessages, completeMsg],
      };
    }

    case "APPEND_CHAT_MESSAGES": {
      return {
        ...state,
        chatMessages: [...state.chatMessages, ...action.messages],
      };
    }

    case "ADD_STATUS_LINE": {
      return {
        ...state,
        chatMessages: state.chatMessages.map((msg) => {
          if (msg.id !== action.messageId) return msg;
          return {
            ...msg,
            statusLines: [...(msg.statusLines ?? []), action.line],
          };
        }),
      };
    }

    default: {
      return state;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slugifyBusinessName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "my-restaurant";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getScanFailureStage(code: string | null): OnboardingStage {
  switch (code) {
    case "dns_fail":
      return "website-url"; // prompt to retry
    case "blocked":
    case "timeout":
    case "parse_error":
    case "llm_error":
      return "manual-setup";
    default:
      return "manual-setup";
  }
}

function buildScanResultsMessage(draft: WebsiteImportDraft, id: string): ChatMessage {
  const lines: string[] = ["I finished reading your website. Here's what I learned:"];

  const hours = draft.businessProfile.hours.value;
  if (hours) {
    lines.push(`\n🕐 Hours\n   ${hours}`);
  }

  const menuCount = draft.restaurantKnowledge.menuSections.filter((s) => s.include).length;
  if (menuCount > 0) {
    const names = draft.restaurantKnowledge.menuSections
      .filter((s) => s.include)
      .slice(0, 3)
      .map((s) => s.title)
      .join(", ");
    const itemTotal = draft.restaurantKnowledge.menuSections
      .filter((s) => s.include)
      .reduce((acc, s) => acc + s.items.filter((item) => item.include).length, 0);
    lines.push(`\n📋 Menu\n   Found ${menuCount} menu section${menuCount === 1 ? "" : "s"}: ${names}.\n   ${itemTotal} items total.`);
  }

  const faqCount = draft.faqs.filter((f) => f.include).length;
  if (faqCount > 0) {
    lines.push(`\n❓ Q&As\n   Found ${faqCount} question${faqCount === 1 ? "" : "s"} and answers your chatbot can use.`);
    const examples = draft.faqs
      .filter((f) => f.include)
      .slice(0, 2)
      .map((f) => `   • "${f.question}" → ${f.answer.slice(0, 80)}${f.answer.length > 80 ? "…" : ""}`)
      .join("\n");
    if (examples) lines.push(examples);
  }

  const phone = draft.businessProfile.phone.value;
  const email = draft.businessProfile.email.value;
  const bookingUrl = draft.restaurantKnowledge.reservations.bookingUrl;
  const contactParts: string[] = [];
  if (phone) contactParts.push(phone);
  if (email) contactParts.push(email);
  if (bookingUrl) contactParts.push(`Booking link: ${bookingUrl}`);
  if (contactParts.length > 0) {
    lines.push(`\n📞 Contact info\n   ${contactParts.join(" / ")}`);
  } else {
    lines.push("\n📞 Contact info\n   No phone or email found on your site.");
  }

  const primaryColor = draft.brand.primaryColor.value;
  const logoUrl = draft.brand.logoUrl.value;
  if (primaryColor || logoUrl) {
    const brandParts: string[] = [];
    if (primaryColor) brandParts.push(`primary color (${primaryColor})`);
    if (logoUrl) brandParts.push("logo");
    lines.push(`\n🎨 Brand\n   Picked up your ${brandParts.join(" and ")}.`);
  }

  lines.push("\nThis looks like a solid starting point. Want me to add all of this to your chatbot's knowledge base?");

  return {
    id: `scan-results-${id}`,
    role: "assistant",
    content: lines.join(""),
  };
}

function buildScanErrorMessage(error: ScanError, id: string, scanUrl: string | null): ChatMessage {
  const domain = scanUrl ? extractDomain(scanUrl) : "your site";

  let content: string;
  switch (error.code) {
    case "dns_fail":
      content = `I couldn't reach ${domain}. Can you double-check the URL? If your site uses a subdomain like "www.${domain}" or a path like "/location", try including that.`;
      break;
    case "blocked":
      content = `Your website blocked my scan — this is common with some platforms. No worries, I can set things up manually using the form on the right.`;
      break;
    case "timeout":
      content = `The scan ran into a timeout. No worries — I can set things up manually using the form on the right.`;
      break;
    default:
      content = `The scan ran into a problem (${error.message || "unknown error"}). You can try again or set things up manually using the form on the right.`;
  }

  return {
    id: `scan-error-${id}`,
    role: "assistant",
    content,
  };
}

function buildHandoffMessage(draft: WebsiteImportDraft | null, id: string): ChatMessage {
  // If the scan found contact info, mention it specifically
  const phone = draft?.businessProfile.phone.value;
  const bookingUrl = draft?.restaurantKnowledge.reservations.bookingUrl;

  if (phone) {
    return {
      id: `handoff-found-${id}`,
      role: "assistant",
      content: `Almost done! I found your phone number: ${phone}. Should I use this as your primary contact for the chatbot?\n\nYou can also add a reservation link or email address.`,
      embed: "handoff-input",
    };
  }

  if (bookingUrl) {
    return {
      id: `handoff-booking-${id}`,
      role: "assistant",
      content: `Almost done! I found your reservation link: ${bookingUrl}. Should I use this as your contact method for the chatbot?\n\nYou can also add a phone number or email address.`,
      embed: "handoff-input",
    };
  }

  return { ...HANDOFF_MESSAGE, id: `handoff-prompt-${id}` };
}
