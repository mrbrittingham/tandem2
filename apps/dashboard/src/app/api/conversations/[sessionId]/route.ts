import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionRow = {
  id: string;
  business_id: string;
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId?: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const pathSegment = new URL(request.url).pathname.split("/").filter(Boolean).pop();
    const parsedSessionId = parseSessionId(resolvedParams?.sessionId ?? pathSegment ?? "");

    if (!parsedSessionId.ok) {
      return NextResponse.json({ error: parsedSessionId.reason }, { status: 400 });
    }

    const { sessionId } = parsedSessionId;

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id,business_id,title,created_at,updated_at")
      .eq("id", sessionId)
      .maybeSingle<SessionRow>();

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
        locationId: session.business_id,
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
