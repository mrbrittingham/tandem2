import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";
import { assertMembership, getImportRunById, mapImportRunRow } from "@/lib/website-import/store";

type LocationRow = {
  id: string;
  business_id: string;
  slug: string;
  name: string;
  website_url: string | null;
  last_import_run_id: string | null;
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
    const businessId = (url.searchParams.get("businessId") ?? "").trim();
    const locationSlug = (url.searchParams.get("locationSlug") ?? "").trim();

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    if (!locationSlug) {
      return NextResponse.json({ error: "locationSlug required" }, { status: 400 });
    }

    await assertMembership(supabase, businessId, user.id);

    const { data: locations, error: locationError } = await supabase
      .from("business_locations")
      .select("id,business_id,slug,name,website_url,last_import_run_id")
      .eq("business_id", businessId)
      .eq("slug", locationSlug)
      .limit(1)
      .returns<LocationRow[]>();

    if (locationError) {
      const apiError = toApiError(locationError, "Failed to load location");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const location = locations?.[0];
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const run = location.last_import_run_id
      ? await getImportRunById(supabase, location.last_import_run_id)
      : null;

    return NextResponse.json({
      location: {
        id: location.id,
        businessId: location.business_id,
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

    const apiError = toApiError(error, "Failed to load latest import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
