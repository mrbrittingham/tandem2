import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";
import { assertMembership, getImportRunById, getLocationById, mapImportRunRow } from "@/lib/website-import/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const run = await getImportRunById(supabase, runId);
    if (!run) {
      return NextResponse.json({ error: "Import run not found" }, { status: 404 });
    }

    const location = await getLocationById(supabase, run.location_id);
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await assertMembership(supabase, location.business_id, user.id);

    return NextResponse.json({
      run: mapImportRunRow(run),
      location: {
        id: location.id,
        slug: location.slug,
        name: location.name,
        businessId: location.business_id,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiError = toApiError(error, "Failed to load import run");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
