import { assertDashboardEnv, getChatStore, handleChatGet, handleChatPost, isDevSmokeBypass } from "@tandem/shared/server";

export const runtime = "nodejs";

function hasValidScope(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(request: Request) {
  try {
    assertDashboardEnv();

    const url = new URL(request.url);
    if (!hasValidScope(url.searchParams.get("businessId"))) {
      return Response.json({ error: "businessId required" }, { status: 400 });
    }
    if (!hasValidScope(url.searchParams.get("locationSlug"))) {
      return Response.json({ error: "locationSlug required" }, { status: 400 });
    }

    return handleChatGet(request, { requireRequestApiKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chat history";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (isDevSmokeBypass(request)) {
      assertDashboardEnv();

      const body = await request.clone().json().catch(() => null) as {
        businessId?: unknown;
        locationSlug?: unknown;
        messages?: Array<{ role?: unknown; content?: unknown }>;
      } | null;

      if (!body || !hasValidScope(body.businessId)) {
        return Response.json({ error: "businessId required" }, { status: 400 });
      }
      if (!hasValidScope(body.locationSlug)) {
        return Response.json({ error: "locationSlug required" }, { status: 400 });
      }

      const userMessage = (body.messages ?? []).find(
        (message) => message?.role === "user" && typeof message?.content === "string" && message.content.trim().length > 0,
      );

      if (!userMessage || typeof userMessage.content !== "string") {
        return Response.json({ error: "messages are required" }, { status: 400 });
      }

      const businessId = String(body.businessId).trim();
      const locationSlug = String(body.locationSlug).trim();
      const store = await getChatStore();
      const session = await store.createSession(businessId, { locationSlug });

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
        locationSlug: session.locationSlug ?? null,
      });
    }

    // Keep baseline env checks, but allow chat handler to degrade gracefully
    // when LLM credentials are absent.
    assertDashboardEnv();

    const body = await request.clone().json().catch(() => null) as { businessId?: unknown; locationSlug?: unknown } | null;
    if (!body || !hasValidScope(body.businessId)) {
      return Response.json({ error: "businessId required" }, { status: 400 });
    }
    if (!hasValidScope(body.locationSlug)) {
      return Response.json({ error: "locationSlug required" }, { status: 400 });
    }

    return handleChatPost(request, { requireRequestApiKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send chat message";
    return Response.json({ error: message }, { status: 500 });
  }
}
