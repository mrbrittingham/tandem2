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

    const nextBody = {
      ...body,
      businessId: resolvedScope.businessId,
      businessSlug: resolvedScope.businessSlug,
      locationId: resolvedScope.locationId,
      locationSlug: resolvedScope.locationSlug,
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
