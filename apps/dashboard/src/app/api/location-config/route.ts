import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

type LocationConfigRow = {
  location_id: string;
  assistant_config: Record<string, unknown> | null;
  knowledge_config: Record<string, unknown> | null;
  handoff_config: Record<string, unknown> | null;
  widget_config: Record<string, unknown> | null;
  integrations_config: Record<string, unknown> | null;
  updated_at: string | null;
};

type MembershipRow = {
  business_id: string;
};

type UpdateBody = {
  locationId?: string;
  locationSlug?: string;
  businessId?: string;
  businessSlug?: string;
  assistantConfig?: Record<string, unknown>;
  knowledgeConfig?: Record<string, unknown>;
  handoffConfig?: Record<string, unknown>;
  widgetConfig?: Record<string, unknown>;
  integrationsConfig?: Record<string, unknown>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveSingleMembershipBusinessId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<{ businessId: string } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .returns<MembershipRow[]>();

  if (error) {
    return { error: NextResponse.json({ error: error.message || "Failed to resolve business" }, { status: 500 }) };
  }

  const unique = Array.from(new Set((data ?? []).map((entry) => entry.business_id).filter(Boolean)));
  if (unique.length !== 1) {
    return {
      error: NextResponse.json(
        { error: "Business scope required when multiple businesses are available" },
        { status: 400 },
      ),
    };
  }

  return { businessId: unique[0] };
}

async function resolveLocationId(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  locationId?: string;
  locationSlug?: string;
  businessId?: string;
  businessSlug?: string;
}): Promise<{ locationId: string } | { error: NextResponse }> {
  const locationId = (args.locationId ?? "").trim();
  const locationSlug = (args.locationSlug ?? "").trim();
  const businessIdParam = (args.businessId ?? "").trim();
  const businessSlugParam = (args.businessSlug ?? "").trim();

  if (UUID_PATTERN.test(locationId)) {
    const { data, error } = await args.supabase
      .from("business_locations")
      .select("id")
      .eq("id", locationId)
      .maybeSingle<{ id: string }>();

    if (!error && data?.id) {
      return { locationId: data.id };
    }
  }

  let resolvedBusinessId: string;
  if (businessIdParam || businessSlugParam) {
    try {
      const resolved = await resolveBusinessId({
        supabase: args.supabase,
        businessId: businessIdParam,
        businessSlug: businessSlugParam,
      });
      resolvedBusinessId = resolved.businessId;
    } catch (error) {
      if (error instanceof BusinessResolutionError) {
        const fallback = await resolveSingleMembershipBusinessId(args.supabase, args.userId);
        if ("error" in fallback) return fallback;
        resolvedBusinessId = fallback.businessId;
      } else {
        throw error;
      }
    }
  } else {
    const fallback = await resolveSingleMembershipBusinessId(args.supabase, args.userId);
    if ("error" in fallback) return fallback;
    resolvedBusinessId = fallback.businessId;
  }

  if (locationSlug) {
    const bySlug = await args.supabase
      .from("business_locations")
      .select("id")
      .eq("business_id", resolvedBusinessId)
      .eq("slug", locationSlug)
      .maybeSingle<{ id: string }>();

    if (!bySlug.error && bySlug.data?.id) {
      return { locationId: bySlug.data.id };
    }
  }

  const rows = await args.supabase
    .from("business_locations")
    .select("id")
    .eq("business_id", resolvedBusinessId)
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string }>>();

  if (rows.error) {
    return { error: NextResponse.json({ error: rows.error.message || "Failed to resolve location" }, { status: 500 }) };
  }

  if (!rows.data?.[0]?.id) {
    return { error: NextResponse.json({ error: "Location not found" }, { status: 404 }) };
  }

  return { locationId: rows.data[0].id };
}

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
    const resolvedLocation = await resolveLocationId({
      supabase,
      userId: user.id,
      locationId: url.searchParams.get("locationId") ?? undefined,
      locationSlug: url.searchParams.get("locationSlug") ?? undefined,
      businessId: url.searchParams.get("businessId") ?? undefined,
      businessSlug: url.searchParams.get("businessSlug") ?? undefined,
    });

    if ("error" in resolvedLocation) {
      return resolvedLocation.error;
    }

    const { data, error } = await supabase
      .from("business_location_configs")
      .select("location_id,assistant_config,knowledge_config,handoff_config,widget_config,integrations_config,updated_at")
      .eq("location_id", resolvedLocation.locationId)
      .maybeSingle<LocationConfigRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load location config" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      locationId: resolvedLocation.locationId,
      config: {
        assistantConfig: asObject(data?.assistant_config),
        knowledgeConfig: asObject(data?.knowledge_config),
        handoffConfig: asObject(data?.handoff_config),
        widgetConfig: asObject(data?.widget_config),
        integrationsConfig: asObject(data?.integrations_config),
        updatedAt: data?.updated_at ?? null,
      },
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load location config" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: UpdateBody;
    try {
      body = (await request.json()) as UpdateBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const resolvedLocation = await resolveLocationId({
      supabase,
      userId: user.id,
      locationId: body.locationId,
      locationSlug: body.locationSlug,
      businessId: body.businessId,
      businessSlug: body.businessSlug,
    });

    if ("error" in resolvedLocation) {
      return resolvedLocation.error;
    }

    const existing = await supabase
      .from("business_location_configs")
      .select("location_id,assistant_config,knowledge_config,handoff_config,widget_config,integrations_config")
      .eq("location_id", resolvedLocation.locationId)
      .maybeSingle<LocationConfigRow>();

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message || "Failed to load location config" }, { status: 500 });
    }

    const merged = {
      location_id: resolvedLocation.locationId,
      assistant_config: body.assistantConfig ? { ...asObject(existing.data?.assistant_config), ...body.assistantConfig } : asObject(existing.data?.assistant_config),
      knowledge_config: body.knowledgeConfig ? { ...asObject(existing.data?.knowledge_config), ...body.knowledgeConfig } : asObject(existing.data?.knowledge_config),
      handoff_config: body.handoffConfig ? { ...asObject(existing.data?.handoff_config), ...body.handoffConfig } : asObject(existing.data?.handoff_config),
      widget_config: body.widgetConfig ? { ...asObject(existing.data?.widget_config), ...body.widgetConfig } : asObject(existing.data?.widget_config),
      integrations_config: body.integrationsConfig ? { ...asObject(existing.data?.integrations_config), ...body.integrationsConfig } : asObject(existing.data?.integrations_config),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("business_location_configs")
      .upsert(merged, { onConflict: "location_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message || "Failed to save location config" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      locationId: resolvedLocation.locationId,
      config: {
        assistantConfig: asObject(merged.assistant_config),
        knowledgeConfig: asObject(merged.knowledge_config),
        handoffConfig: asObject(merged.handoff_config),
        widgetConfig: asObject(merged.widget_config),
        integrationsConfig: asObject(merged.integrations_config),
      },
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save location config" },
      { status: 500 },
    );
  }
}
