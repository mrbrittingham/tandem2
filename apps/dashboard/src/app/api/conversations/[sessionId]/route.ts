import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertDashboardEnv, getChatStore, isDevSmokeBypass, isMissingColumnError, recordScopeFallback } from "@tandem/shared/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

type SessionRow = {
  id: string;
  business_id: string;
  location_slug?: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function parseSessionId(value: string) {
  const sessionId = value.trim();
  if (!sessionId) {
    return { ok: false as const, reason: "sessionId is required" };
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return { ok: false as const, reason: "sessionId is invalid" };
  }
  return { ok: true as const, sessionId };
}

function parseScopeValue(value: string | null, key: string) {
  const parsed = (value ?? "").trim();
  if (!parsed) {
    return { ok: false as const, reason: `${key} required` };
  }
  if (!SCOPE_PATTERN.test(parsed)) {
    return { ok: false as const, reason: `${key} is invalid` };
  }
  return { ok: true as const, value: parsed };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId?: string }> }) {
  try {
    assertDashboardEnv();

    const resolvedParams = await params;
    const pathSegment = new URL(request.url).pathname.split("/").filter(Boolean).pop();
    const parsedSessionId = parseSessionId(resolvedParams?.sessionId ?? pathSegment ?? "");

    if (!parsedSessionId.ok) {
      return NextResponse.json({ error: parsedSessionId.reason }, { status: 400 });
    }

    const { sessionId } = parsedSessionId;
    const parsedBusinessId = parseScopeValue(new URL(request.url).searchParams.get("businessId"), "businessId");
    const parsedLocationSlug = parseScopeValue(new URL(request.url).searchParams.get("locationSlug"), "locationSlug");

    if (!parsedBusinessId.ok) {
      return NextResponse.json({ error: parsedBusinessId.reason }, { status: 400 });
    }

    if (!parsedLocationSlug.ok) {
      return NextResponse.json({ error: parsedLocationSlug.reason }, { status: 400 });
    }

    const businessId = parsedBusinessId.value;
    const locationSlug = parsedLocationSlug.value;

    if (isDevSmokeBypass(request)) {
      const store = await getChatStore();
      const session = await store.getSession(sessionId);

      if (!session || session.businessId !== businessId || (session.locationSlug ?? null) !== locationSlug) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const messages = await store.listMessages(sessionId);

      return NextResponse.json({
        session: {
          id: session.id,
          businessId: session.businessId,
          locationSlug: session.locationSlug ?? null,
          title: session.title ?? null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
      });
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const withLocationSelect = await supabase
      .from("chat_sessions")
      .select("id,business_id,location_slug,title,created_at,updated_at")
      .eq("id", sessionId)
      .eq("business_id", businessId)
      .eq("location_slug", locationSlug)
      .maybeSingle<SessionRow>();

    const session = withLocationSelect.data;
    const sessionError = withLocationSelect.error;

    if (sessionError && isMissingColumnError(sessionError, "location_slug")) {
      recordScopeFallback({
        source: "api/conversations:detail",
        detail: "chat_sessions.location_slug is unavailable; using legacy select without location_slug",
      });

      const fallbackSelect = await supabase
        .from("chat_sessions")
        .select("id,business_id,title,created_at,updated_at")
        .eq("id", sessionId)
        .eq("business_id", locationSlug)
        .maybeSingle<SessionRow>();

      if (fallbackSelect.error) {
        const code = fallbackSelect.error.code || "unknown";
        const message = fallbackSelect.error.message || "Unknown Supabase error";
        return NextResponse.json(
          { error: `Failed to load conversation (code: ${code}): ${message}` },
          { status: 500 },
        );
      }

      if (!fallbackSelect.data) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const fallbackSession = fallbackSelect.data;

      const { data: messages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("id,role,content,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>();

      if (messagesError) {
        const code = messagesError.code || "unknown";
        const message = messagesError.message || "Unknown Supabase error";
        return NextResponse.json(
          { error: `Failed to load messages (code: ${code}): ${message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        session: {
          id: fallbackSession.id,
          businessId: fallbackSession.business_id,
          locationSlug: null,
          title: fallbackSession.title ?? null,
          createdAt: fallbackSession.created_at,
          updatedAt: fallbackSession.updated_at,
        },
        messages: (messages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })),
      });
    }

    if (sessionError) {
      const code = sessionError.code || "unknown";
      const message = sessionError.message || "Unknown Supabase error";
      return NextResponse.json(
        { error: `Failed to load conversation (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id,role,content,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>();

    if (messagesError) {
      const code = messagesError.code || "unknown";
      const message = messagesError.message || "Unknown Supabase error";
      return NextResponse.json(
        { error: `Failed to load messages (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        businessId: session.business_id,
        locationSlug: session.location_slug ?? null,
        title: session.title ?? null,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      messages: (messages ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
