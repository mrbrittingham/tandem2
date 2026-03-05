import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/website-import/api-errors";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tableCheck = await supabase
      .from("onboarding_import_runs")
      .select("id")
      .limit(1);

    if (tableCheck.error) {
      const apiError = toApiError(tableCheck.error, "Failed to verify onboarding_import_runs");
      return NextResponse.json({
        ok: false,
        code: apiError.code,
        error: apiError.message,
        checks: {
          onboardingImportRunsTable: false,
          businessLocationsWebsiteUrlColumn: false,
        },
      }, { status: apiError.status });
    }

    const columnCheck = await supabase
      .from("business_locations")
      .select("id,website_url")
      .limit(1);

    if (columnCheck.error) {
      const apiError = toApiError(columnCheck.error, "Failed to verify business_locations.website_url");
      return NextResponse.json({
        ok: false,
        code: apiError.code,
        error: apiError.message,
        checks: {
          onboardingImportRunsTable: true,
          businessLocationsWebsiteUrlColumn: false,
        },
      }, { status: apiError.status });
    }

    return NextResponse.json({
      ok: true,
      checks: {
        onboardingImportRunsTable: true,
        businessLocationsWebsiteUrlColumn: true,
      },
    });
  } catch (error) {
    const apiError = toApiError(error, "Failed to run schema check");
    return NextResponse.json({ ok: false, error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
