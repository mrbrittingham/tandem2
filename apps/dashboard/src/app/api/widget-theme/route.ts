import { NextResponse } from "next/server";
import type { WidgetThemeSettings } from "@tandem/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWidgetTheme } from "@/lib/widget-theme";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;
const BUSINESS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

type ThemePayload = {
  theme?: Partial<WidgetThemeSettings>;
  locationName?: string;
  locationAddress?: string;
};

type JsonObject = Record<string, unknown>;

type LocationRow = {
  id: string;
  slug: string;
};

type MembershipRow = {
  id: string;
};

function parseLocationSlug(value: string | null) {
  const locationSlug = (value ?? "").trim();
  if (!locationSlug) {
    return { ok: false as const, reason: "locationSlug required" };
  }
  if (!SLUG_PATTERN.test(locationSlug)) {
    return { ok: false as const, reason: "locationSlug is invalid" };
  }
  return { ok: true as const, locationSlug };
}

function parseBusinessId(value: string | null) {
  const businessId = (value ?? "").trim();
  if (!businessId) {
    return { ok: false as const, reason: "businessId required" };
  }
  if (!BUSINESS_ID_PATTERN.test(businessId)) {
    return { ok: false as const, reason: "businessId is invalid" };
  }
  return { ok: true as const, businessId };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeThemePatch(theme: Partial<WidgetThemeSettings> | undefined): Partial<WidgetThemeSettings> {
  if (!isJsonObject(theme)) {
    return {};
  }

  const base = normalizeWidgetTheme({
    primaryColor: "#3170FC",
    accentColor: "#9E4770",
    surfaceColor: "#FFFFFF",
    textPrimaryColor: "#0F172A",
    textSecondaryColor: "#475569",
    fontFamily: "'Inter', sans-serif",
  });

  const merged = normalizeWidgetTheme({
    ...base,
    ...(theme as Partial<WidgetThemeSettings>),
    headerBackground: {
      ...base.headerBackground,
      ...(isJsonObject(theme.headerBackground) ? theme.headerBackground : {}),
      mode: isJsonObject(theme.headerBackground) && theme.headerBackground.mode === "gradient" ? "gradient" : (base.headerBackground?.mode ?? "solid"),
      gradient: {
        ...(base.headerBackground?.gradient ?? {}),
        ...(isJsonObject(theme.headerBackground?.gradient) ? theme.headerBackground.gradient : {}),
      },
    },
    quickActions: {
      ...base.quickActions,
      ...(isJsonObject(theme.quickActions) ? theme.quickActions : {}),
    },
    sendButton: {
      ...base.sendButton,
      ...(isJsonObject(theme.sendButton) ? theme.sendButton : {}),
    },
  });

  const patch: Partial<WidgetThemeSettings> = {};

  if ("primaryColor" in theme) patch.primaryColor = merged.primaryColor;
  if ("accentColor" in theme) patch.accentColor = merged.accentColor;
  if ("surfaceColor" in theme) patch.surfaceColor = merged.surfaceColor;
  if ("textPrimaryColor" in theme) patch.textPrimaryColor = merged.textPrimaryColor;
  if ("textSecondaryColor" in theme) patch.textSecondaryColor = merged.textSecondaryColor;
  if ("fontFamily" in theme) patch.fontFamily = merged.fontFamily;
  if ("logoUrl" in theme) patch.logoUrl = merged.logoUrl;

  if ("headerBackground" in theme && isJsonObject(theme.headerBackground)) {
    patch.headerBackground = {
      mode: merged.headerBackground?.mode ?? "solid",
      solidColor: merged.headerBackground?.solidColor,
      gradient: merged.headerBackground?.gradient,
    };
  }

  if ("quickActions" in theme && isJsonObject(theme.quickActions)) {
    patch.quickActions = {
      color: merged.quickActions?.color ?? merged.accentColor,
      variant: merged.quickActions?.variant,
    };
  }

  if ("sendButton" in theme && isJsonObject(theme.sendButton)) {
    patch.sendButton = {
      color: merged.sendButton?.color ?? merged.primaryColor,
      textColor: merged.sendButton?.textColor,
    };
  }

  return patch;
}

function extractThemeFromWidgetConfig(widgetConfig: unknown): Partial<WidgetThemeSettings> {
  if (!isJsonObject(widgetConfig)) {
    return {};
  }

  if (isJsonObject(widgetConfig.theme)) {
    return widgetConfig.theme as Partial<WidgetThemeSettings>;
  }

  return widgetConfig as Partial<WidgetThemeSettings>;
}

function mergeTheme(existing: Partial<WidgetThemeSettings>, patch: Partial<WidgetThemeSettings>) {
  const next: Partial<WidgetThemeSettings> = {
    ...existing,
    ...patch,
  };

  if (existing.headerBackground || patch.headerBackground) {
    next.headerBackground = {
      ...(existing.headerBackground ?? {}),
      ...(patch.headerBackground ?? {}),
      mode: patch.headerBackground?.mode ?? existing.headerBackground?.mode ?? "solid",
      gradient: {
        ...(existing.headerBackground?.gradient ?? {}),
        ...(patch.headerBackground?.gradient ?? {}),
      },
    };
  }

  if (existing.quickActions || patch.quickActions) {
    next.quickActions = {
      ...(existing.quickActions ?? {}),
      ...(patch.quickActions ?? {}),
    };
  }

  if (existing.sendButton || patch.sendButton) {
    next.sendButton = {
      ...(existing.sendButton ?? {}),
      ...(patch.sendButton ?? {}),
    };
  }

  return next;
}

function normalizeThemeForResponse(theme: Partial<WidgetThemeSettings>) {
  return normalizeWidgetTheme({
    primaryColor: theme.primaryColor ?? "#3170FC",
    accentColor: theme.accentColor ?? "#9E4770",
    surfaceColor: theme.surfaceColor ?? "#FFFFFF",
    textPrimaryColor: theme.textPrimaryColor ?? "#0F172A",
    textSecondaryColor: theme.textSecondaryColor ?? "#475569",
    fontFamily: theme.fontFamily ?? "'Inter', sans-serif",
    logoUrl: theme.logoUrl,
    headerBackground: theme.headerBackground,
    quickActions: theme.quickActions,
    sendButton: theme.sendButton,
  });
}

async function ensureBusinessMembership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .limit(1)
    .returns<MembershipRow[]>();

  if (error) {
    return { ok: false as const, status: 500, error: error.message || "Failed to check membership" };
  }

  if (!data?.[0]) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const };
}

async function resolveLocationId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  locationSlug: string,
) {
  const { data, error } = await supabase
    .from("business_locations")
    .select("id,slug")
    .eq("business_id", businessId)
    .eq("slug", locationSlug)
    .limit(1)
    .returns<LocationRow[]>();

  if (error) {
    return { ok: false as const, status: 500, error: error.message || "Failed to resolve location" };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false as const, status: 404, error: "Location not found" };
  }

  return { ok: true as const, locationId: row.id };
}

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Location";
}

async function ensureLocationIdForSave(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    businessId: string;
    locationSlug: string;
    userId: string;
    locationName?: string;
    locationAddress?: string;
  },
) {
  const resolved = await resolveLocationId(supabase, input.businessId, input.locationSlug);
  if (resolved.ok) {
    return resolved;
  }

  if (resolved.status !== 404) {
    return resolved;
  }

  const { data, error } = await supabase
    .from("business_locations")
    .insert({
      business_id: input.businessId,
      slug: input.locationSlug,
      name: (input.locationName ?? "").trim() || humanizeSlug(input.locationSlug),
      address: (input.locationAddress ?? "").trim() || null,
      created_by: input.userId,
    })
    .select("id")
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (error) {
    return { ok: false as const, status: 500, error: error.message || "Failed to create location" };
  }

  const created = data?.[0];
  if (!created) {
    return { ok: false as const, status: 500, error: "Failed to create location" };
  }

  return { ok: true as const, locationId: created.id };
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
    const parsedBusinessId = parseBusinessId(url.searchParams.get("businessId"));
    const parsedLocationSlug = parseLocationSlug(url.searchParams.get("locationSlug"));

    if (!parsedBusinessId.ok) {
      return NextResponse.json({ error: parsedBusinessId.reason }, { status: 400 });
    }

    if (!parsedLocationSlug.ok) {
      return NextResponse.json({ error: parsedLocationSlug.reason }, { status: 400 });
    }

    const membership = await ensureBusinessMembership(supabase, parsedBusinessId.businessId, user.id);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const resolved = await resolveLocationId(supabase, parsedBusinessId.businessId, parsedLocationSlug.locationSlug);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { data, error } = await supabase
      .from("business_location_configs")
      .select("widget_config")
      .eq("location_id", resolved.locationId)
      .maybeSingle<{ widget_config: JsonObject | null }>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load widget theme" }, { status: 500 });
    }

    const existingTheme = extractThemeFromWidgetConfig(data?.widget_config);

    return NextResponse.json({
      businessId: parsedBusinessId.businessId,
      locationSlug: parsedLocationSlug.locationSlug,
      theme: normalizeThemeForResponse(existingTheme),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load widget theme";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const url = new URL(request.url);
    const parsedBusinessId = parseBusinessId(url.searchParams.get("businessId"));
    const parsedLocationSlug = parseLocationSlug(url.searchParams.get("locationSlug"));
    if (!parsedBusinessId.ok) {
      return NextResponse.json({ error: parsedBusinessId.reason }, { status: 400 });
    }
    if (!parsedLocationSlug.ok) {
      return NextResponse.json({ error: parsedLocationSlug.reason }, { status: 400 });
    }

    let body: ThemePayload;
    try {
      body = (await request.json()) as ThemePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const themePatch = normalizeThemePatch(body.theme);
    if (!Object.keys(themePatch).length) {
      return NextResponse.json({ error: "theme payload is required" }, { status: 400 });
    }

    const membership = await ensureBusinessMembership(supabase, parsedBusinessId.businessId, user.id);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const resolved = await ensureLocationIdForSave(supabase, {
      businessId: parsedBusinessId.businessId,
      locationSlug: parsedLocationSlug.locationSlug,
      userId: user.id,
      locationName: body.locationName,
      locationAddress: body.locationAddress,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const existingConfigResult = await supabase
      .from("business_location_configs")
      .select("widget_config")
      .eq("location_id", resolved.locationId)
      .maybeSingle<{ widget_config: JsonObject | null }>();

    if (existingConfigResult.error) {
      return NextResponse.json({ error: existingConfigResult.error.message || "Failed to load widget config" }, { status: 500 });
    }

    const existingConfig = isJsonObject(existingConfigResult.data?.widget_config)
      ? existingConfigResult.data.widget_config
      : {};

    const existingTheme = extractThemeFromWidgetConfig(existingConfig);
    const mergedTheme = normalizeThemeForResponse(mergeTheme(existingTheme, themePatch));

    const mergedWidgetConfig: JsonObject = {
      ...existingConfig,
      theme: mergedTheme,
    };

    const { error } = await supabase
      .from("business_location_configs")
      .upsert(
        {
          location_id: resolved.locationId,
          widget_config: mergedWidgetConfig,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "location_id",
        },
      );

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to save widget theme" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      businessId: parsedBusinessId.businessId,
      locationSlug: parsedLocationSlug.locationSlug,
      theme: mergedTheme,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save widget theme";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
