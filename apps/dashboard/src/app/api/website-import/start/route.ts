import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";

type Body = {
  businessId?: string;
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

    const businessId = (body.businessId ?? "").trim();
    const locationSlug = (body.locationSlug ?? "").trim();
    const url = (body.url ?? "").trim();

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    if (!locationSlug) {
      return NextResponse.json({ error: "locationSlug required" }, { status: 400 });
    }
    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("business_memberships")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1)
      .returns<Array<{ id: string }>>();

    if (membershipError) {
      const apiError = toApiError(membershipError, "Failed to verify membership");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    if (!memberships?.[0]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: locations, error: locationError } = await supabase
      .from("business_locations")
      .select("id")
      .eq("business_id", businessId)
      .eq("slug", locationSlug)
      .limit(1)
      .returns<LocationRow[]>();

    if (locationError) {
      const apiError = toApiError(locationError, "Failed to resolve location");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const locationId = locations?.[0]?.id;
    if (!locationId) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const importResponse = await fetch(new URL(`/api/location/${encodeURIComponent(locationId)}/website-import`, request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ url }),
    });

    const payload = await importResponse.json().catch(() => ({ error: "Import failed" }));
    return NextResponse.json(payload, { status: importResponse.status });
  } catch (error) {
    const apiError = toApiError(error, "Failed to start import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
