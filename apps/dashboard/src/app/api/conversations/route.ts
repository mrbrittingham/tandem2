import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const LOCATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

type SessionRow = {
  id: string;
  business_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

function parseLocationId(value: string | null) {
  const locationId = (value ?? "").trim();
  if (!locationId) {
    return { ok: false as const, reason: "locationId required" };
  }
  if (!LOCATION_ID_PATTERN.test(locationId)) {
    return { ok: false as const, reason: "locationId is invalid" };
  }
  return { ok: true as const, locationId };
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsedLocationId = parseLocationId(url.searchParams.get("locationId"));

    if (!parsedLocationId.ok) {
      return NextResponse.json({ error: parsedLocationId.reason }, { status: 400 });
    }

    const { locationId } = parsedLocationId;

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id,business_id,title,created_at,updated_at")
      .eq("business_id", locationId)
      .order("updated_at", { ascending: false })
      .limit(DEFAULT_LIMIT)
      .returns<SessionRow[]>();

    if (error) {
      const code = error.code || "unknown";
      const message = error.message || "Unknown Supabase error";
      return NextResponse.json(
        { error: `Failed to load conversations (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    const sessions = data ?? [];

    return NextResponse.json({
      locationId,
      sessions: sessions.map((session) => ({
        id: session.id,
        locationId: session.business_id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
