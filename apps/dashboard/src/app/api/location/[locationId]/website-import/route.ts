import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";
import { assertMembership, getLocationById } from "@/lib/website-import/store";
import { normalizeWebsiteUrl } from "@/lib/website-import/utils";

type RequestBody = {
  url?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const url = normalizeWebsiteUrl(body.url ?? "");
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
      .update({
        last_import_run_id: runId,
      })
      .eq("id", location.id);

    return NextResponse.json({
      ok: true,
      runId,
      status: "queued",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiError = toApiError(error, "Failed to start website import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
