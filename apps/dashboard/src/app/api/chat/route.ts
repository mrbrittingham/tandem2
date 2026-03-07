import { getChatStore, handleChatGet, handleChatPost, isDevSmokeBypass } from "@tandem/shared/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

export const runtime = "nodejs";

type ChatScopeInput = {
  businessId?: unknown;
  businessSlug?: unknown;
  locationId?: unknown;
  locationSlug?: unknown;
};

type ChatPostBody = ChatScopeInput & {
  messages?: Array<{ role?: unknown; content?: unknown }>;
  system?: string;
};

type LocationRow = {
  id: string;
  slug: string;
};

type ScopeResolutionSuccess = {
  ok: true;
  businessId: string;
  businessSlug?: string;
  locationId: string;
  locationSlug: string;
};

type ScopeResolutionFailure = {
  ok: false;
  status: number;
  error: string;
  detail: string;
};

type ScopeResolution = ScopeResolutionSuccess | ScopeResolutionFailure;

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildKnowledgeSystemPrompt(knowledgeConfig: unknown): string {
  const root = asObject(knowledgeConfig);
  const structured = asObject(root.structured);
  const fields = asObject(structured.fields);
  const imported = asObject(root.structuredWebsiteKnowledge);
  const contact = asObject(root.contact);
  const importedPolicies = Array.isArray(root.importedPolicies) ? root.importedPolicies : [];
  const reservations = asObject(imported.reservations);
  const memberships = asObject(imported.memberships);
  const events = Array.isArray(imported.events) ? imported.events.slice(0, 12) : [];
  const menuSections = Array.isArray(imported.menuSections) ? imported.menuSections.slice(0, 6) : [];

  const eventLines = events
    .map((entry) => {
      const object = asObject(entry);
      const title = asString(object.title);
      if (!title) {
        return "";
      }
      const date = asString(object.date);
      const time = asString(object.time);
      const description = asString(object.description).slice(0, 180);
      const sourceUrl = asString(object.sourceUrl);
      const bookingInfo = asString(object.bookingInfo);
      const category = asString(object.category);
      return [
        `- ${title}${date ? ` | ${date}` : ""}${time ? ` ${time}` : ""}`,
        category ? `  category: ${category}` : "",
        description ? `  summary: ${description}` : "",
        bookingInfo ? `  booking: ${bookingInfo}` : "",
        sourceUrl ? `  url: ${sourceUrl}` : "",
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n");

  const menuLines = menuSections
    .map((entry) => {
      const object = asObject(entry);
      const sectionTitle = asString(object.title);
      const items = Array.isArray(object.items) ? object.items.slice(0, 5) : [];
      const names = items.map((item) => asString(asObject(item).name)).filter(Boolean);
      if (!sectionTitle && !names.length) {
        return "";
      }
      return `- ${sectionTitle || "Menu"}: ${names.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n");

  const policyLines = importedPolicies
    .slice(0, 6)
    .map((entry) => {
      const object = asObject(entry);
      const title = asString(object.title);
      const description = asString(object.description);
      if (!title || !description) {
        return "";
      }
      return `- ${title}: ${description.slice(0, 180)}`;
    })
    .filter(Boolean)
    .join("\n");

  const reservationBookingUrl = asString(reservations.bookingUrl);

  const todayIso = new Date().toISOString().slice(0, 10);

  const sections = [
    "You are a restaurant concierge assistant. Prioritize structured website-derived knowledge over generic assumptions.",
    "If data is missing, say you are not sure and offer the best next step.",
    "When asked to book, provide the reservation URL/platform if available.",
    `Current date: ${todayIso}`,
    "Event answer rules: Use only the event records listed below for event-specific answers; do not invent events.",
    "Event answer rules: For general event questions, prioritize nearest upcoming events first and avoid past events unless asked.",
    "Event answer rules: For 'this weekend', interpret weekend as Friday-Sunday relative to the current date.",
    "Event answer rules: If a named event is requested (for example, a wine club pickup party), return that event's date, time, summary, booking guidance, and event URL first.",
    `Business overview: ${asString(fields.businessOverview)}`,
    `Cuisine/service style: ${asString(fields.cuisineServiceStyle)}`,
    `Hours: ${asString(fields.hours) || asString(contact.hours)}`,
    `Location details: ${asString(fields.locationDetails) || asString(contact.address)}`,
    `Phone: ${asString(contact.phone)}`,
    `Email: ${asString(contact.email)}`,
    `Reservation guidance: ${asString(fields.reservationsGuidance) || asString(reservations.instructions)}`,
    reservationBookingUrl ? `Reservation booking URL: ${reservationBookingUrl}` : "",
    `Membership guidance: ${asString(fields.memberships) || asString(memberships.benefits)}`,
    `Menu highlights: ${asString(fields.menuHighlights)}`,
    eventLines ? `Upcoming events:\n${eventLines}` : "",
    menuLines ? `Menu sections:\n${menuLines}` : "",
    policyLines ? `Policies:\n${policyLines}` : "",
  ].filter((entry) => entry.trim().length > 0);

  return sections.join("\n\n");
}

async function loadLocationKnowledgeConfig(locationId: string): Promise<Record<string, unknown> | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("business_location_configs")
      .select("knowledge_config")
      .eq("location_id", locationId)
      .maybeSingle<{ knowledge_config: Record<string, unknown> | null }>();
    return data?.knowledge_config ?? null;
  } catch {
    return null;
  }
}

function readScopeValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createScopeFailure(status: number, error: string, detail: string): ScopeResolutionFailure {
  return {
    ok: false,
    status,
    error,
    detail,
  };
}

function logScopeFailure(method: "GET" | "POST", failure: ScopeResolutionFailure, raw: ChatScopeInput) {
  console.warn(
    `[api/chat] scope_resolution_failed method=${method} status=${failure.status} detail=${failure.detail} ` +
      `businessId=${readScopeValue(raw.businessId) ?? "<missing>"} businessSlug=${readScopeValue(raw.businessSlug) ?? "<missing>"} ` +
      `locationId=${readScopeValue(raw.locationId) ?? "<missing>"} locationSlug=${readScopeValue(raw.locationSlug) ?? "<missing>"}`,
  );
}

function logScopeResolved(method: "GET" | "POST", scope: ScopeResolutionSuccess) {
  console.info(
    `[api/chat] scope_resolved method=${method} businessId=${scope.businessId} businessSlug=${scope.businessSlug ?? "<none>"} ` +
      `locationId=${scope.locationId} locationSlug=${scope.locationSlug}`,
  );
}

async function resolveLocationScope(input: {
  businessId: string;
  locationId?: string;
  locationSlug?: string;
}): Promise<ScopeResolutionSuccess | ScopeResolutionFailure> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("business_locations")
    .select("id,slug")
    .eq("business_id", input.businessId)
    .limit(1);

  if (input.locationId) {
    query = query.eq("id", input.locationId);
  }

  if (input.locationSlug) {
    query = query.eq("slug", input.locationSlug);
  }

  const { data, error } = await query.returns<LocationRow[]>();
  if (error) {
    return createScopeFailure(500, "Failed to resolve chat location", `location_lookup_error:${error.message}`);
  }

  const row = data?.[0];
  if (!row) {
    if (input.locationId && input.locationSlug) {
      return createScopeFailure(400, "locationId/locationSlug do not match business", "invalid_location_scope");
    }
    if (input.locationId) {
      return createScopeFailure(400, "locationId is invalid for businessId/businessSlug", "invalid_location_id");
    }
    return createScopeFailure(400, "locationSlug is invalid for businessId/businessSlug", "invalid_location_slug");
  }

  return {
    ok: true,
    businessId: input.businessId,
    locationId: row.id,
    locationSlug: row.slug,
  };
}

async function resolveChatScope(input: ChatScopeInput): Promise<ScopeResolution> {
  const businessIdInput = readScopeValue(input.businessId);
  const businessSlugInput = readScopeValue(input.businessSlug);
  const locationIdInput = readScopeValue(input.locationId);
  const locationSlugInput = readScopeValue(input.locationSlug);

  if (!businessIdInput && !businessSlugInput) {
    return createScopeFailure(400, "businessId or businessSlug required", "missing_business_identifier");
  }

  if (!locationIdInput && !locationSlugInput) {
    return createScopeFailure(400, "locationId or locationSlug required", "missing_location_identifier");
  }

  let resolvedBusinessId = businessIdInput;
  let resolvedBusinessSlug: string | undefined;

  if (!resolvedBusinessId || businessSlugInput) {
    try {
      const supabase = await createSupabaseServerClient();
      const resolved = await resolveBusinessId({
        supabase,
        businessId: resolvedBusinessId,
        businessSlug: businessSlugInput,
      });
      resolvedBusinessId = resolved.businessId;
      resolvedBusinessSlug = resolved.businessSlug ?? undefined;
    } catch (error) {
      if (error instanceof BusinessResolutionError) {
        const status = error.status >= 500 ? error.status : 400;
        return createScopeFailure(status, error.message, error.code);
      }
      return createScopeFailure(500, "Failed to resolve business scope", "business_resolution_error");
    }
  }

  if (!resolvedBusinessId) {
    return createScopeFailure(400, "businessId could not be resolved", "invalid_business_identifier");
  }

  const resolvedLocation = await resolveLocationScope({
    businessId: resolvedBusinessId,
    locationId: locationIdInput,
    locationSlug: locationSlugInput,
  });

  if (!resolvedLocation.ok) {
    return resolvedLocation;
  }

  return {
    ...resolvedLocation,
    businessSlug: resolvedBusinessSlug,
  };
}

async function readPostBody(request: Request): Promise<ChatPostBody | null> {
  return (await request.clone().json().catch(() => null)) as ChatPostBody | null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawScope: ChatScopeInput = {
      businessId: url.searchParams.get("businessId"),
      businessSlug: url.searchParams.get("businessSlug"),
      locationId: url.searchParams.get("locationId"),
      locationSlug: url.searchParams.get("locationSlug"),
    };

    const resolvedScope = await resolveChatScope(rawScope);

    if (!resolvedScope.ok) {
      logScopeFailure("GET", resolvedScope, rawScope);
      return Response.json({ error: resolvedScope.error, detail: resolvedScope.detail }, { status: resolvedScope.status });
    }

    logScopeResolved("GET", resolvedScope);

    const nextUrl = new URL(request.url);
    nextUrl.searchParams.set("businessId", resolvedScope.businessId);
    nextUrl.searchParams.set("locationSlug", resolvedScope.locationSlug);

    return handleChatGet(new Request(nextUrl.toString(), request), { requireRequestApiKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chat history";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await readPostBody(request);
    if (!body) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const resolvedScope = await resolveChatScope(body);
    if (!resolvedScope.ok) {
      logScopeFailure("POST", resolvedScope, body);
      return Response.json({ error: resolvedScope.error, detail: resolvedScope.detail }, { status: resolvedScope.status });
    }

    logScopeResolved("POST", resolvedScope);

    if (isDevSmokeBypass(request)) {
      const userMessage = (body.messages ?? []).find(
        (message) => message?.role === "user" && typeof message?.content === "string" && message.content.trim().length > 0,
      );

      if (!userMessage || typeof userMessage.content !== "string") {
        return Response.json({ error: "messages are required" }, { status: 400 });
      }

      const store = await getChatStore();
      const session = await store.createSession(resolvedScope.businessId, { locationSlug: resolvedScope.locationSlug });

      await store.appendMessage(session.id, {
        role: "user",
        content: userMessage.content,
      });

      await store.updateSession(session.id, {
        title: userMessage.content.trim().slice(0, 80),
      });

      return Response.json({
        ok: true,
        sessionId: session.id,
        businessId: session.businessId,
        locationId: resolvedScope.locationId,
        locationSlug: session.locationSlug ?? null,
      });
    }

    const locationKnowledgeConfig = await loadLocationKnowledgeConfig(resolvedScope.locationId);
    const knowledgeSystem = locationKnowledgeConfig ? buildKnowledgeSystemPrompt(locationKnowledgeConfig) : "";

    const nextBody = {
      ...body,
      businessId: resolvedScope.businessId,
      businessSlug: resolvedScope.businessSlug,
      locationId: resolvedScope.locationId,
      locationSlug: resolvedScope.locationSlug,
      system: [knowledgeSystem, body.system].filter((entry) => typeof entry === "string" && entry.trim().length > 0).join("\n\n"),
    };

    const nextRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(nextBody),
    });

    return handleChatPost(nextRequest, { requireRequestApiKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send chat message";
    return Response.json({ error: message }, { status: 500 });
  }
}
