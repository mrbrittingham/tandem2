import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  operatorTools,
  generateHumanSummary,
  type PendingChange,
} from "@/lib/operator-tools/tool-definitions";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Input screening — lightweight injection guardrails for operator chat.
// Mirrors the INJECTION_PATTERNS in packages/shared/src/server/chat-handler.ts.
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(your\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i,
  /you\s+are\s+now\s+(a|an|DAN|jailbr)/i,
  /forget\s+(everything|all|your)\s+(above|instructions|rules)/i,
  /repeat\s+(your|the)\s+(system\s+)?prompt/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /(?:^|\.\s*)act\s+as\s+(if\s+you\s+(are|were)\s+|a\s+|an\s+)/i,
  /(?:^|\.\s*)pretend\s+(you\s+are|to\s+be)\s+/i,
];

function screenUserInput(text: string): { ok: true } | { ok: false; reply: string } {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return { ok: false, reply: "Please type a message to get started." };
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reply:
          "I can only help with restaurant operator tasks like configuring your chatbot. What would you like to work on?",
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageInput = { role?: unknown; content?: unknown };
type PostBody = {
  businessId?: unknown;
  locationId?: unknown;
  locationSlug?: unknown;
  messages?: MessageInput[];
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// Business context loader
// ---------------------------------------------------------------------------

async function loadBusinessContext(locationId: string): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: loc } = await supabase
      .from("business_locations")
      .select("name, slug, location_config")
      .eq("id", locationId)
      .maybeSingle<{
        name: string;
        slug: string;
        location_config: Record<string, unknown> | null;
      }>();

    if (!loc) return "";

    const cfg = asObject(loc.location_config);
    const profile = asObject(cfg.profile);
    const lines: string[] = [
      `Business name: ${asString(loc.name) || asString(profile.businessName)}`,
    ];

    if (asString(profile.tagline)) lines.push(`Tagline: ${asString(profile.tagline)}`);
    if (asString(profile.phone)) lines.push(`Phone: ${asString(profile.phone)}`);
    if (asString(profile.email)) lines.push(`Email: ${asString(profile.email)}`);
    if (asString(profile.website)) lines.push(`Website: ${asString(profile.website)}`);
    if (asString(profile.timezone)) lines.push(`Timezone: ${asString(profile.timezone)}`);

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildOperatorSystemPrompt(businessContext: string): string {
  const today = new Date().toISOString().slice(0, 10);

  return [
    "You are Tandem — an AI assistant built specifically for restaurant operators.",
    "You are talking directly to the restaurant owner or manager inside their Tandem dashboard.",
    "Your job: help them configure, optimize, and get the most out of their AI chatbot for their restaurant.",

    "You can help with:",
    "- Setting up chatbot knowledge (menu, hours, policies, FAQs, reservation flows)",
    "- Writing and refining chatbot copy",
    "- Configuring reservation flows, handoff rules, and escalation contacts",
    "- Understanding how to use integrations like Toast, OpenTable, Yelp, etc.",
    "- Advising on chatbot strategy (what to automate, when to hand off to staff)",
    "- Troubleshooting chatbot responses",
    "- Recommending what to add to their Knowledge section",

    // Tool calling guidance
    "When the operator asks you to make a configuration change (e.g., set hours, add an FAQ,",
    "update contact info), use the appropriate tool to propose the change. A confirmation card",
    "will be shown before anything is saved, so call the tool immediately when you understand",
    "the request. Briefly describe what you're proposing in your response text.",

    "Tone: Expert, direct, and practical — like a knowledgeable SaaS onboarding specialist who also knows restaurants.",
    "Be concise. Give actionable advice, not fluff.",
    "Use markdown to structure long answers (bullet lists, bold headers).",
    "Never be robotic. Speak like a smart colleague, not a customer support script.",

    "You are NOT the customer-facing chatbot. Never play the role of a restaurant concierge.",
    "If someone asks 'what are your hours?' treat it as a question about how to configure hours in Tandem.",
    "Stay focused on helping the operator run their chatbot and business better.",

    `Current date: ${today}`,
    businessContext ? `\nOperator's restaurant context:\n${businessContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse request ─────────────────────────────────────────────────────
    const body: PostBody = await request.json().catch(() => ({}));

    const locationId = asString(body.locationId);
    const locationSlug = asString(body.locationSlug);
    const businessId = asString(body.businessId);

    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter(
            (m) => typeof m?.role === "string" && typeof m?.content === "string",
          )
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content as string,
          }))
      : [];

    if (messages.length === 0) {
      return Response.json({ error: "messages are required" }, { status: 400 });
    }

    // ── Injection screen on the last user message ─────────────────────────
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const screen = screenUserInput(lastUserMsg.content);
      if (!screen.ok) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(screen.reply));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }

    // ── Load context + build system prompt ───────────────────────────────
    const businessContext = locationId ? await loadBusinessContext(locationId) : "";
    const systemPrompt = buildOperatorSystemPrompt(businessContext);

    // ── Call LLM with operator tools ──────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "LLM not configured" }, { status: 500 });
    }

    const openai = createOpenAI({ apiKey });
    const model = process.env.LLM_MODEL || "gpt-4o";

    console.info("[operator-chat] llm-request", {
      userId: user.id,
      locationId: locationId || null,
      businessId: businessId || null,
      model,
      messageCount: messages.length,
    });

    const result = await generateText({
      model: openai(model),
      system: systemPrompt,
      messages,
      tools: operatorTools,
      toolChoice: "auto",
      maxOutputTokens: 800,
    });

    // ── Tool call detected — return PendingChange JSON ────────────────────
    if (result.toolCalls && result.toolCalls.length > 0) {
      const call = result.toolCalls[0];
      const toolName = call.toolName as string;
      const toolArgs = ((call as { input?: unknown }).input ?? {}) as Record<string, unknown>;

      console.info("[operator-chat] tool-call", {
        userId: user.id,
        toolName,
        locationId: locationId || null,
        businessId: businessId || null,
      });

      const humanSummary = generateHumanSummary(toolName, toolArgs);

      const pendingChange: PendingChange = {
        type: "pending_change",
        toolName,
        toolArgs,
        humanSummary,
        // Scope resolved from the authenticated request — not client-supplied
        locationId,
        locationSlug,
        businessId,
      };

      const assistantMessage =
        result.text?.trim() ||
        "Here's what I'd update — review and confirm to apply the change:";

      return Response.json({ pendingChange, assistantMessage });
    }

    // ── No tool call — return text as a plain-text streaming response ─────
    const text = result.text ?? "";
    console.info("[operator-chat] text-response", {
      userId: user.id,
      chars: text.length,
      locationId: locationId || null,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    // Log the full error string so we can diagnose LLM/API failures without
    // leaking internal details to the client.
    console.error("[operator-chat] unhandled error:", raw, {
      model: process.env.LLM_MODEL || "gpt-4o",
      hasApiKey: !!process.env.OPENAI_API_KEY,
    });
    // Friendly client message distinguishes config errors from transient ones.
    const isModelError = /model.*not.*exist|does not exist|invalid.*model/i.test(raw);
    const clientMessage = isModelError
      ? "LLM model is not configured correctly. Contact your administrator."
      : "Failed to process message. Please try again.";
    return Response.json({ error: clientMessage }, { status: 500 });
  }
}
