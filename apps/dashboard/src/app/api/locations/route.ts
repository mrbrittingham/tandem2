import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

const ENABLE_DEMO_DATA = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "1";

type CreateLocationBody = {
  name?: string;
  address?: string;
  mode?: "fresh" | "copy";
  sourceLocationId?: string;
};

type PatchLocationBody = {
  locationId?: string;
  locationSlug?: string;
  businessId?: string;
  businessSlug?: string;
  name?: string;
  address?: string;
};

type LocationRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  address: string | null;
  created_at: string;
};

function isLegacyDemoLocation(row: LocationRow): boolean {
  const slug = (row.slug ?? "").trim().toLowerCase();
  const name = (row.name ?? "").trim().toLowerCase();
  const address = (row.address ?? "").trim().toLowerCase();

  if (slug === "valencia-st" || slug === "mission-bay") {
    return true;
  }

  if (name === "valencia st" || name === "mission bay") {
    return true;
  }

  if (address.includes("980 valencia st") || address.includes("500 terry francine st")) {
    return true;
  }

  return false;
}

type MembershipRow = {
  business_id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const filtered = ENABLE_DEMO_DATA
      ? (data ?? [])
      : (data ?? []).filter((location) => !isLegacyDemoLocation(location));

    return NextResponse.json({
      locations: filtered.map((location) => ({
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

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: PatchLocationBody;
    try {
      body = (await request.json()) as PatchLocationBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const locationId = (body.locationId ?? "").trim();
    const locationSlug = (body.locationSlug ?? "").trim();
    const businessIdParam = (body.businessId ?? "").trim();
    const businessSlugParam = (body.businessSlug ?? "").trim();
    const name = (body.name ?? "").trim();
    const address = (body.address ?? "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const canUseId = UUID_PATTERN.test(locationId);
    const hasBusinessScope = Boolean(businessIdParam || businessSlugParam);
    const canUseSlug = Boolean(locationSlug);

    if (!canUseId && !canUseSlug) {
      return NextResponse.json(
        {
          error:
            "Provide a valid locationId UUID, or provide locationSlug",
        },
        { status: 400 },
      );
    }

    const updatePayload = {
      name,
      address,
    };

    if (canUseId) {
      const { data, error } = await supabase
        .from("business_locations")
        .update(updatePayload)
        .eq("id", locationId)
        .select("id,business_id,name,slug,address,created_at")
        .maybeSingle<LocationRow>();

      if (!error && data) {
        return NextResponse.json({
          ok: true,
          location: {
            id: data.id,
            businessId: data.business_id,
            business_id: data.business_id,
            name: data.name,
            slug: data.slug,
            address: data.address,
            createdAt: data.created_at,
          },
        });
      }
    }

    if (!canUseSlug) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    let resolvedBusinessId: string;
    if (hasBusinessScope) {
      const resolved = await resolveBusinessId({
        supabase,
        businessId: businessIdParam,
        businessSlug: businessSlugParam,
      });
      resolvedBusinessId = resolved.businessId;
    } else {
      const { data: memberships, error: membershipsError } = await supabase
        .from("business_memberships")
        .select("business_id")
        .eq("user_id", user.id)
        .returns<MembershipRow[]>();

      if (membershipsError) {
        return NextResponse.json(
          { error: membershipsError.message || "Failed to resolve account business" },
          { status: 500 },
        );
      }

      const uniqueBusinessIds = Array.from(new Set((memberships ?? []).map((entry) => entry.business_id).filter(Boolean)));
      if (uniqueBusinessIds.length !== 1) {
        return NextResponse.json(
          { error: "Business scope required when multiple businesses are available" },
          { status: 400 },
        );
      }

      resolvedBusinessId = uniqueBusinessIds[0];
    }

    const { data, error } = await supabase
      .from("business_locations")
      .update(updatePayload)
      .eq("business_id", resolvedBusinessId)
      .eq("slug", locationSlug)
      .select("id,business_id,name,slug,address,created_at")
      .maybeSingle<LocationRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update location" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      location: {
        id: data.id,
        businessId: data.business_id,
        business_id: data.business_id,
        name: data.name,
        slug: data.slug,
        address: data.address,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to update location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
