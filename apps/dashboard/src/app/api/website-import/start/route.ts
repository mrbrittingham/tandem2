import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";
import { assertMembership, getLocationById } from "@/lib/website-import/store";
import { normalizeWebsiteUrl } from "@/lib/website-import/utils";

type Body = {
  businessId?: string;
  businessSlug?: string;
  locationSlug?: string;
  url?: string;
};

type LocationRow = {
  id: string;
};

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

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const businessIdParam = (body.businessId ?? "").trim();
    const businessSlugParam = (body.businessSlug ?? "").trim();
    const locationSlug = (body.locationSlug ?? "").trim();
    const rawUrl = (body.url ?? "").trim();

    if (!businessIdParam && !businessSlugParam) {
      return NextResponse.json({ error: "businessSlug or businessId required" }, { status: 400 });
    }
    if (!locationSlug) {
      return NextResponse.json({ error: "locationSlug required" }, { status: 400 });
    }
    if (!rawUrl) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    console.info("[website-import/start] request", {
      businessIdParam: businessIdParam || null,
      businessSlugParam: businessSlugParam || null,
      locationSlug,
    });

    const resolved = await resolveBusinessId({
      supabase,
      businessId: businessIdParam,
      businessSlug: businessSlugParam,
    });

    console.info("[website-import/start] business resolved", {
      resolvedBusinessId: resolved.businessId,
      resolvedBusinessSlug: resolved.businessSlug,
      inputMode: resolved.inputMode,
    });

    const { data: membershipRows, error: membershipError } = await supabase
      .from("business_memberships")
      .select("id")
      .eq("business_id", resolved.businessId)
      .eq("user_id", user.id)
      .limit(1)
      .returns<Array<{ id: string }>>();

    if (membershipError) {
      const apiError = toApiError(membershipError, "Failed to verify membership");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    if (!membershipRows?.[0]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: locations, error: locationError } = await supabase
      .from("business_locations")
      .select("id")
      .eq("business_id", resolved.businessId)
      .eq("slug", locationSlug)
      .limit(1)
      .returns<LocationRow[]>();

    if (locationError) {
      const apiError = toApiError(locationError, "Failed to resolve location");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const locationId = locations?.[0]?.id;
    if (!locationId) {
      console.warn("[website-import/start] location not found", {
        resolvedBusinessId: resolved.businessId,
        locationSlug,
      });
      return NextResponse.json(
        { error: "Invalid locationSlug for this business. Pick a valid location.", code: "INVALID_LOCATION_SLUG" },
        { status: 400 },
      );
    }

    console.info("[website-import/start] location found", { locationId, locationSlug });

    // Inline the /api/location/[locationId]/website-import logic directly
    // to avoid a self-referential HTTP fetch which fails behind the Replit proxy.
    const url = normalizeWebsiteUrl(rawUrl);
    const location = await getLocationById(supabase, locationId);
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await assertMembership(supabase, location.business_id, user.id);

    const nowIso = new Date().toISOString();
    const { data: insertedRuns, error: insertError } = await supabase
      .from("onboarding_import_runs")
      .insert({
        location_id: location.id,
        url,
        status: "queued",
        created_by: user.id,
        created_at: nowIso,
      })
      .select("id")
      .limit(1)
      .returns<Array<{ id: string }>>();

    if (insertError || !insertedRuns?.[0]) {
      const apiError = toApiError(insertError, "Failed to create import run");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const runId = insertedRuns[0].id;

    await supabase
      .from("business_locations")
      .update({ last_import_run_id: runId })
      .eq("id", location.id);

    console.info("[website-import/start] import queued", { locationId, runId });

    return NextResponse.json({ ok: true, runId, status: "queued" });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiError = toApiError(error, "Failed to start import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
