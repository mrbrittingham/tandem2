import { NextResponse } from "next/server";
import { assertDashboardEnv, getChatStore, isDevSmokeBypass, isMissingColumnError, recordScopeFallback } from "@tandem/shared/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

type SessionRow = {
  id: string;
  business_id: string;
  location_slug?: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

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

export async function GET(request: Request) {
  try {
    assertDashboardEnv();

    const url = new URL(request.url);
    const parsedBusinessId = parseScopeValue(url.searchParams.get("businessId"), "businessId");
    const parsedLocationSlug = parseScopeValue(url.searchParams.get("locationSlug"), "locationSlug");

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
      const sessions = await store.listSessions(businessId, { limit: DEFAULT_LIMIT });
      const scoped = sessions.filter((session) => (session.locationSlug ?? null) === locationSlug);

      return NextResponse.json({
        businessId,
        locationSlug,
        sessions: scoped.map((session) => ({
          id: session.id,
          businessId: session.businessId,
          locationSlug: session.locationSlug ?? null,
          title: session.title ?? null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
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

    const scopedQuery = await supabase
      .from("chat_sessions")
      .select("id,business_id,location_slug,title,created_at,updated_at")
      .eq("business_id", businessId)
      .eq("location_slug", locationSlug)
      .order("updated_at", { ascending: false })
      .limit(DEFAULT_LIMIT)
      .returns<SessionRow[]>();

    if (scopedQuery.error && isMissingColumnError(scopedQuery.error, "location_slug")) {
      recordScopeFallback({
        source: "api/conversations:list",
        businessId,
        locationSlug,
        detail: "chat_sessions.location_slug is unavailable; using legacy business_id=locationSlug fallback",
      });

      const legacyFallback = await supabase
        .from("chat_sessions")
        .select("id,business_id,title,created_at,updated_at")
        .eq("business_id", locationSlug)
        .order("updated_at", { ascending: false })
        .limit(DEFAULT_LIMIT)
        .returns<SessionRow[]>();

      if (legacyFallback.error) {
        const code = legacyFallback.error.code || "unknown";
        const message = legacyFallback.error.message || "Unknown Supabase error";
        return NextResponse.json(
          { error: `Failed to load conversations (code: ${code}): ${message}` },
          { status: 500 },
        );
      }

      const sessions = legacyFallback.data ?? [];

      return NextResponse.json({
        businessId,
        locationSlug,
        sessions: sessions.map((session) => ({
          id: session.id,
          businessId: session.business_id,
          locationSlug,
          title: session.title,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
        })),
      });
    }

    if (scopedQuery.error) {
      const code = scopedQuery.error.code || "unknown";
      const message = scopedQuery.error.message || "Unknown Supabase error";
      return NextResponse.json(
        { error: `Failed to load conversations (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    const sessions = scopedQuery.data ?? [];

    return NextResponse.json({
      businessId,
      locationSlug,
      sessions: sessions.map((session) => ({
        id: session.id,
        businessId: session.business_id,
        locationSlug: session.location_slug ?? null,
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
