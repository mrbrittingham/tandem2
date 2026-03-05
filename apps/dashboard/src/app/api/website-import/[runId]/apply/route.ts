import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildApplyPayload } from "@/lib/website-import/apply";
import { toApiError } from "@/lib/website-import/api-errors";
import type { WebsiteImportDraft } from "@/lib/website-import/types";
import { isWebsiteImportDraft } from "@/lib/website-import/schema";
import { assertMembership, getImportRunById, getLocationById, mapImportRunRow } from "@/lib/website-import/store";

type JsonObject = Record<string, unknown>;

type ApplyBody = {
  draft?: WebsiteImportDraft;
};

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export async function POST(
  request: Request,
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

    if (run.status !== "succeeded") {
      return NextResponse.json({ error: "Only successful runs can be applied" }, { status: 400 });
    }

    const location = await getLocationById(supabase, run.location_id);
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await assertMembership(supabase, location.business_id, user.id);

    let body: ApplyBody;
    try {
      body = (await request.json()) as ApplyBody;
    } catch {
      body = {};
    }

    const baseRun = mapImportRunRow(run);
    const rawDraft = body.draft ?? baseRun.result;
    const draft = isWebsiteImportDraft(rawDraft) ? rawDraft : null;
    if (!draft) {
      return NextResponse.json({ error: "Run has no draft to apply" }, { status: 400 });
    }

    const { data: existingConfig, error: configError } = await supabase
      .from("business_location_configs")
      .select("widget_config,knowledge_config")
      .eq("location_id", run.location_id)
      .maybeSingle<{ widget_config: JsonObject | null; knowledge_config: JsonObject | null }>();

    if (configError) {
      const apiError = toApiError(configError, "Failed to load location config");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    const nowIso = new Date().toISOString();
    const applied = buildApplyPayload({
      runId,
      sourceUrl: run.url,
      draft,
      existingWidgetConfig: existingConfig?.widget_config,
      existingKnowledgeConfig: existingConfig?.knowledge_config,
      nowIso,
    });

    const { error: upsertError } = await supabase
      .from("business_location_configs")
      .upsert(
        {
          location_id: run.location_id,
          widget_config: applied.widgetConfig,
          knowledge_config: applied.knowledgeConfig,
          updated_at: nowIso,
        },
        {
          onConflict: "location_id",
        },
      );

    if (upsertError) {
      const apiError = toApiError(upsertError, "Failed to apply import");
      return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
    }

    await supabase
      .from("business_locations")
      .update({
        website_url: run.url,
        last_import_run_id: run.id,
      })
      .eq("id", run.location_id);

    await supabase
      .from("onboarding_import_runs")
      .update({
        result_json: draft,
        applied_at: nowIso,
        applied_by: user.id,
      })
      .eq("id", run.id);

    return NextResponse.json({
      ok: true,
      runId,
      locationId: run.location_id,
      websiteUrl: run.url,
      summary: {
        faqCount: applied.faqs.length,
        policyCount: applied.policies.length,
        theme: applied.theme,
        profile: {
          name: draft.businessProfile.name.value,
          phone: draft.businessProfile.phone.value,
          email: draft.businessProfile.email.value,
          address: draft.businessProfile.address.value,
          hours: draft.businessProfile.hours.value,
        },
      },
      knowledgeConfig: asObject(applied.knowledgeConfig),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiError = toApiError(error, "Failed to apply import");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
