import { handleChatPost } from "@tandem/shared/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

async function loadBusinessContext(locationId: string): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: loc } = await supabase
      .from("business_locations")
      .select("name, slug, location_config")
      .eq("id", locationId)
      .maybeSingle<{ name: string; slug: string; location_config: Record<string, unknown> | null }>();

    if (!loc) return "";

    const cfg = asObject(loc.location_config);
    const profile = asObject(cfg.profile);
    const lines: string[] = [`Business name: ${asString(loc.name) || asString(profile.businessName)}`];

    if (asString(profile.tagline)) lines.push(`Tagline: ${asString(profile.tagline)}`);
    if (asString(profile.address)) lines.push(`Address: ${asString(profile.address)}`);
    if (asString(profile.phone)) lines.push(`Phone: ${asString(profile.phone)}`);
    if (asString(profile.email)) lines.push(`Email: ${asString(profile.email)}`);
    if (asString(profile.website)) lines.push(`Website: ${asString(profile.website)}`);
    if (asString(profile.timezone)) lines.push(`Timezone: ${asString(profile.timezone)}`);

    return lines.join("\n");
  } catch {
    return "";
  }
}

function buildOperatorSystemPrompt(businessContext: string): string {
  const today = new Date().toISOString().slice(0, 10);

  return [
    // Role
    "You are Tandem — an AI assistant built specifically for restaurant operators.",
    "You are talking directly to the restaurant owner or manager inside their Tandem dashboard.",
    "Your job: help them configure, optimize, and get the most out of their AI chatbot for their restaurant.",

    // Scope & capabilities
    "You can help with:",
    "- Setting up chatbot knowledge (menu, hours, policies, FAQs, reservation flows)",
    "- Writing and refining chatbot copy",
    "- Configuring reservation flows, handoff rules, and escalation contacts",
    "- Understanding how to use integrations like Toast, OpenTable, Yelp, etc.",
    "- Advising on chatbot strategy (what to automate, when to hand off to staff)",
    "- Troubleshooting chatbot responses",
    "- Recommending what to add to their Knowledge section",

    // Tone
    "Tone: Expert, direct, and practical — like a knowledgeable SaaS onboarding specialist who also knows restaurants.",
    "Be concise. Give actionable advice, not fluff.",
    "Use markdown to structure long answers (bullet lists, bold headers).",
    "Never be robotic. Speak like a smart colleague, not a customer support script.",

    // Boundaries
    "You are NOT the customer-facing chatbot. Never play the role of a restaurant concierge.",
    "If someone asks 'what are your hours?' treat it as a question about how to configure hours in Tandem, not as a guest question.",
    "Stay focused on helping the operator run their chatbot and business better.",

    // Context
    `Current date: ${today}`,
    businessContext ? `\nOperator's restaurant context:\n${businessContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const body: PostBody = await request.json().catch(() => ({}));

    const locationId = asString(body.locationId);
    const locationSlug = asString(body.locationSlug);
    const businessId = asString(body.businessId);

    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter((m) => typeof m?.role === "string" && typeof m?.content === "string")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }))
      : [];

    if (messages.length === 0) {
      return Response.json({ error: "messages are required" }, { status: 400 });
    }

    const businessContext = locationId ? await loadBusinessContext(locationId) : "";
    const system = buildOperatorSystemPrompt(businessContext);

    const nextBody = {
      businessId: businessId || "operator",
      locationSlug: locationSlug || "operator",
      messages,
      system,
      maxTokens: 800,
    };

    const nextRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(nextBody),
    });

    return handleChatPost(nextRequest, { requireRequestApiKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process message";
    return Response.json({ error: message }, { status: 500 });
  }
}
