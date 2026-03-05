import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

type CreateLocationBody = {
  name?: string;
  address?: string;
  mode?: "fresh" | "copy";
  sourceLocationId?: string;
};

type LocationRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  address: string | null;
  created_at: string;
};

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
    const businessIdParam = (url.searchParams.get("businessId") ?? "").trim();
    const businessSlugParam = (url.searchParams.get("businessSlug") ?? "").trim();

    let resolvedBusinessId: string | null = null;
    if (businessIdParam || businessSlugParam) {
      const resolved = await resolveBusinessId({
        supabase,
        businessId: businessIdParam,
        businessSlug: businessSlugParam,
      });
      resolvedBusinessId = resolved.businessId;
    }

    let query = supabase
      .from("business_locations")
      .select("id,business_id,name,slug,address,created_at")
      .order("created_at", { ascending: true });

    if (resolvedBusinessId) {
      query = query.eq("business_id", resolvedBusinessId);
    }

    const { data, error } = await query.returns<LocationRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load locations" }, { status: 500 });
    }

    return NextResponse.json({
      locations: (data ?? []).map((location) => ({
        id: location.id,
        businessId: location.business_id,
        name: location.name,
        slug: location.slug,
        address: location.address,
        createdAt: location.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreateLocationBody;
    try {
      body = (await request.json()) as CreateLocationBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = (body.name ?? "").trim();
    const address = (body.address ?? "").trim() || null;
    const mode = body.mode ?? "fresh";
    const sourceLocationId = (body.sourceLocationId ?? "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (mode !== "fresh" && mode !== "copy") {
      return NextResponse.json({ error: "mode must be fresh or copy" }, { status: 400 });
    }

    if (mode === "copy" && !sourceLocationId) {
      return NextResponse.json({ error: "sourceLocationId is required for copy mode" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_business_location", {
      p_name: name,
      p_address: address,
      p_copy_from_location_id: mode === "copy" ? sourceLocationId : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create location" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, location: data?.[0] ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
