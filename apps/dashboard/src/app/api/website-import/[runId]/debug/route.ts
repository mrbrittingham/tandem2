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

    const mapped = mapImportRunRow(run);
    const pageChars = mapped.pages.reduce((sum, page) => sum + page.textExcerpt.length, 0);

    return NextResponse.json({
      runId: mapped.id,
      status: mapped.status,
      url: mapped.url,
      timestamps: {
        createdAt: mapped.createdAt,
        startedAt: mapped.startedAt,
        finishedAt: mapped.finishedAt,
        appliedAt: mapped.appliedAt,
      },
      diagnostics: {
        pageCount: mapped.pages.length,
        totalExcerptChars: pageChars,
        signalCounts: {
          emails: mapped.signals.emails.length,
          phones: mapped.signals.phones.length,
          addresses: mapped.signals.addresses.length,
          hours: mapped.signals.hours.length,
          bookingLinks: mapped.signals.bookingLinks.length,
          socialLinks: mapped.signals.socialLinks.length,
          logoCandidates: mapped.signals.logoCandidates.length,
          faviconCandidates: mapped.signals.faviconCandidates.length,
          colorCandidates: mapped.signals.colorCandidates.length,
          fontCandidates: mapped.signals.fontCandidates.length,
        },
        draftCounts: {
          events: mapped.result?.restaurantKnowledge.events.length ?? 0,
          menuSections: mapped.result?.restaurantKnowledge.menuSections.length ?? 0,
          faqs: mapped.result?.faqs.length ?? 0,
          policies: mapped.result?.policies.length ?? 0,
        },
      },
      pages: mapped.pages.map((page) => ({
        url: page.url,
        title: page.title,
        pageType: page.pageType ?? "general",
        excerptChars: page.textExcerpt.length,
        headingCount: Array.isArray(page.headingText) ? page.headingText.length : 0,
        excerptPreview: page.textExcerpt.slice(0, 300),
      })),
      signals: mapped.signals,
      draft: mapped.result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiError = toApiError(error, "Failed to load import debug details");
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
}
