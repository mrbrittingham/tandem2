import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";
import { assertMembership, getImportRunById, mapImportRunRow } from "@/lib/website-import/store";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

type LocationRow = {
  id: string;
  business_id: string;
  slug: string;
  name: string;
  website_url: string | null;
  last_import_run_id: string | null;
};

type BusinessRow = {
  slug: string;
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
    const runIdParam = (url.searchParams.get("runId") ?? "").trim();
    const businessIdParam = (url.searchParams.get("businessId") ?? "").trim();
    const businessSlugParam = (url.searchParams.get("businessSlug") ?? "").trim();
    const locationSlug = (url.searchParams.get("locationSlug") ?? "").trim();

    // ── Path A: Direct lookup by runId ──────────────────────────────────────
    if (runIdParam) {
      console.info("[website-import/latest] runId request", { runId: runIdParam });

      const run = await getImportRunById(supabase, runIdParam);
      if (!run) {
        return NextResponse.json({ error: "Import run not found", code: "NOT_FOUND" }, { status: 404 });
      }

      const { data: locations, error: locationError } = await supabase
        .from("business_locations")
        .select("id,business_id,slug,name,website_url,last_import_run_id")
        .eq("id", run.location_id)
        .limit(1)
        .returns<LocationRow[]>();

      if (locationError) {
        const apiError = toApiError(locationError, "Failed to load location");
        return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
      }

      const location = locations?.[0];
      if (!location) {
        return NextResponse.json({ error: "Location not found for this run", code: "NOT_FOUND" }, { status: 404 });
      }

      await assertMembership(supabase, location.business_id, user.id);

      const { data: businesses, error: businessError } = await supabase
        .from("businesses")
        .select("slug")
        .eq("id", location.business_id)
        .limit(1)
        .returns<BusinessRow[]>();

      if (businessError) {
        const apiError = toApiError(businessError, "Failed to load business");
        return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
      }

      const businessSlug = businesses?.[0]?.slug ?? null;

      console.info("[website-import/latest] runId resolved", {
        runId: run.id,
        locationId: location.id,
        status: run.status,
      });

      return NextResponse.json({
        location: {
          id: location.id,
          businessId: location.business_id,
          businessSlug,
          slug: location.slug,
          name: location.name,
          websiteUrl: location.website_url,
          lastImportRunId: location.last_import_run_id,
        },
        run: mapImportRunRow(run),
      });
    }

    // ── Path B: Lookup by businessSlug + locationSlug ───────────────────────
    if (!businessIdParam && !businessSlugParam) {
      return NextResponse.json({ error: "runId, businessSlug, or businessId required" }, { status: 400 });
    }

    if (!locationSlug) {
      return NextResponse.json({ error: "locationSlug required" }, { status: 400 });
    }

    console.info("[website-import/latest] request", {
      businessIdParam: businessIdParam || null,
      businessSlugParam: businessSlugParam || null,
      locationSlug,
    });

    const resolved = await resolveBusinessId({
      supabase,
      businessId: businessIdParam,
      businessSlug: businessSlugParam,
    });

    console.info("[website-import/latest] business resolved", {
      resolvedBusinessId: resolved.businessId,
      resolvedBusinessSlug: resolved.businessSlug,
      inputMode: resolved.inputMode,
    });

    await assertMembership(supabase, resolved.businessId, user.id);

    const { data: locations, error: locationError } = await supabase
      .from("business_locations")
      .select("id,business_id,slug,name,website_url,last_import_run_id")
      .eq("business_id", resolved.businessId)
      .eq("slug", locationSlug)
      .limit(1)
      .returns<LocationRow[]>();

    if (locationError) {
      const apiError = toApiError(locationError, "Failed to load location");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const location = locations?.[0];
    if (!location) {
      console.warn("[website-import/latest] location not found", {
        resolvedBusinessId: resolved.businessId,
        locationSlug,
      });
      return NextResponse.json({ error: "Invalid locationSlug for this business. Pick a valid location.", code: "INVALID_LOCATION_SLUG" }, { status: 400 });
    }

    console.info("[website-import/latest] location found", {
      locationId: location.id,
      locationSlug: location.slug,
    });

    const run = location.last_import_run_id
      ? await getImportRunById(supabase, location.last_import_run_id)
      : null;

    if (run) {
      console.info("[website-import/latest] run found", { runId: run.id });
    } else {
      console.info("[website-import/latest] run not found", { locationId: location.id });
    }

    return NextResponse.json({
      location: {
        id: location.id,
        businessId: location.business_id,
        businessSlug: resolved.businessSlug,
        slug: location.slug,
        name: location.name,
        websiteUrl: location.website_url,
        lastImportRunId: location.last_import_run_id,
      },
      run: run ? mapImportRunRow(run) : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const apiError = toApiError(error, "Failed to load latest import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
