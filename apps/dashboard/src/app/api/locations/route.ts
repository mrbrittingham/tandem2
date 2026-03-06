import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessResolutionError, resolveBusinessId } from "@/lib/website-import/business-resolver";

const ENABLE_DEMO_DATA = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "1";

type CreateLocationBody = {
  businessName?: string;
  name?: string;
  address?: string;
  mode?: "fresh" | "copy";
  sourceLocationId?: string;
};

type PatchLocationBody = {
  locationId?: string;
  locationSlug?: string;
  businessId?: string;
  businessSlug?: string;
  name?: string;
  address?: string;
};

type LocationRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  address: string | null;
  created_at: string;
};

type LocationConfigRow = {
  location_id: string;
  assistant_config: unknown;
  knowledge_config: unknown;
  handoff_config: unknown;
  widget_config: unknown;
  integrations_config: unknown;
};

function toLocationResponse(row: LocationRow) {
  return {
    id: row.id,
    businessId: row.business_id,
    business_id: row.business_id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    createdAt: row.created_at,
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isLegacyDemoLocation(row: LocationRow): boolean {
  const slug = (row.slug ?? "").trim().toLowerCase();
  const name = (row.name ?? "").trim().toLowerCase();
  const address = (row.address ?? "").trim().toLowerCase();

  if (slug === "valencia-st" || slug === "mission-bay") {
    return true;
  }

  if (name === "valencia st" || name === "mission bay") {
    return true;
  }

  if (address.includes("980 valencia st") || address.includes("500 terry francine st")) {
    return true;
  }

  return false;
}

type MembershipRow = {
  business_id: string;
};

async function resolveSingleMembershipBusinessId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<{ businessId: string } | { error: NextResponse }> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .returns<MembershipRow[]>();

  if (membershipsError) {
    return {
      error: NextResponse.json(
        { error: membershipsError.message || "Failed to resolve account business" },
        { status: 500 },
      ),
    };
  }

  const uniqueBusinessIds = Array.from(new Set((memberships ?? []).map((entry) => entry.business_id).filter(Boolean)));
  if (uniqueBusinessIds.length !== 1) {
    return {
      error: NextResponse.json(
        { error: "Business scope required when multiple businesses are available" },
        { status: 400 },
      ),
    };
  }

  return { businessId: uniqueBusinessIds[0] };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "business";
}

async function bootstrapMembershipForUser(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  preferredName: string;
}): Promise<string | null> {
  const base = slugify(args.preferredName);
  const candidateId = `${base}-${args.userId.replace(/-/g, "").slice(0, 8)}`;

  const { error } = await args.supabase.rpc("bootstrap_membership", {
    business_id: candidateId,
    role: "owner",
  });

  if (error) {
    return null;
  }

  return candidateId;
}

async function createLocationDirect(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  businessId: string;
  name: string;
  address: string | null;
  sourceLocationId?: string | null;
}): Promise<{ data: LocationRow | null; error: string | null }> {
  const baseSlug = slugify(args.name);

  const { data: existingLocations, error: existingError } = await args.supabase
    .from("business_locations")
    .select("slug")
    .eq("business_id", args.businessId)
    .returns<Array<{ slug: string }>>();

  if (existingError) {
    return { data: null, error: existingError.message || "Failed to prepare location slug" };
  }

  const existing = new Set((existingLocations ?? []).map((entry) => normalizeText(entry.slug)).filter(Boolean));
  let slugCandidate = baseSlug;
  let counter = 2;
  while (existing.has(normalizeText(slugCandidate))) {
    slugCandidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const { data, error } = await args.supabase
    .from("business_locations")
    .insert({
      business_id: args.businessId,
      slug: slugCandidate,
      name: args.name,
      address: args.address,
      created_by: args.userId,
    })
    .select("id,business_id,name,slug,address,created_at")
    .single<LocationRow>();

  if (error) {
    return { data: null, error: error.message || "Failed to create location" };
  }

  if (args.sourceLocationId) {
    const source = await args.supabase
      .from("business_location_configs")
      .select("location_id,assistant_config,knowledge_config,handoff_config,widget_config,integrations_config")
      .eq("location_id", args.sourceLocationId)
      .maybeSingle<LocationConfigRow>();

    if (!source.error && source.data) {
      await args.supabase
        .from("business_location_configs")
        .upsert({
          location_id: data.id,
          assistant_config: source.data.assistant_config,
          knowledge_config: source.data.knowledge_config,
          handoff_config: source.data.handoff_config,
          widget_config: source.data.widget_config,
          integrations_config: source.data.integrations_config,
        }, { onConflict: "location_id" });
    }
  }

  return { data, error: null };
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
    const businessIdParam = (url.searchParams.get("businessId") ?? "").trim();
    const businessSlugParam = (url.searchParams.get("businessSlug") ?? "").trim();
    const locationIdParam = (url.searchParams.get("locationId") ?? "").trim();
    const locationSlugParam = (url.searchParams.get("locationSlug") ?? "").trim();

    let resolvedBusinessId: string | null = null;
    if (businessIdParam || businessSlugParam) {
      const resolved = await resolveBusinessId({
        supabase,
        businessId: businessIdParam,
        businessSlug: businessSlugParam,
      });
      resolvedBusinessId = resolved.businessId;
    }

    let query = supabase
      .from("business_locations")
      .select("id,business_id,name,slug,address,created_at")
      .order("created_at", { ascending: true });

    if (resolvedBusinessId) {
      query = query.eq("business_id", resolvedBusinessId);
    }

    if (UUID_PATTERN.test(locationIdParam)) {
      query = query.eq("id", locationIdParam);
    }

    if (locationSlugParam) {
      query = query.eq("slug", locationSlugParam);
    }

    const { data, error } = await query.returns<LocationRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load locations" }, { status: 500 });
    }

    const filtered = ENABLE_DEMO_DATA
      ? (data ?? [])
      : (data ?? []).filter((location) => !isLegacyDemoLocation(location));

    const locations = filtered.map(toLocationResponse);
    const resolvedLocation = locations[0];

    console.info("[locations/get]", {
      requestedLocationId: locationIdParam || null,
      requestedLocationSlug: locationSlugParam || null,
      resolvedBusinessId,
      resolvedLocationId: resolvedLocation?.id ?? null,
      resolvedLocationSlug: resolvedLocation?.slug ?? null,
      readValues: locations.slice(0, 5).map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        address: entry.address,
      })),
      totalLocations: locations.length,
    });

    return NextResponse.json({ locations });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    let body: CreateLocationBody;
    try {
      body = (await request.json()) as CreateLocationBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = (body.name ?? "").trim();
    const businessName = (body.businessName ?? "").trim();
    const address = (body.address ?? "").trim() || null;
    const mode = body.mode ?? "fresh";
    const sourceLocationId = (body.sourceLocationId ?? "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (mode !== "fresh" && mode !== "copy") {
      return NextResponse.json({ error: "mode must be fresh or copy" }, { status: 400 });
    }

    if (mode === "copy" && !sourceLocationId) {
      return NextResponse.json({ error: "sourceLocationId is required for copy mode" }, { status: 400 });
    }

    let businessIdForCreate: string | null = null;
    const membershipResolution = await resolveSingleMembershipBusinessId(supabase, user.id);
    if ("error" in membershipResolution) {
      const bootstrappedBusinessId = await bootstrapMembershipForUser({
        supabase,
        userId: user.id,
        preferredName: businessName || name,
      });
      businessIdForCreate = bootstrappedBusinessId;
    } else {
      businessIdForCreate = membershipResolution.businessId;
    }

    if (!businessIdForCreate) {
      return NextResponse.json({ error: "Failed to resolve account business" }, { status: 500 });
    }

    const created = await createLocationDirect({
      supabase,
      userId: user.id,
      businessId: businessIdForCreate,
      name,
      address,
      sourceLocationId: mode === "copy" ? sourceLocationId : null,
    });

    if (created.error || !created.data) {
      return NextResponse.json({ error: created.error || "Failed to create location" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, businessId: businessIdForCreate, location: created.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: PatchLocationBody;
    try {
      body = (await request.json()) as PatchLocationBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const locationId = (body.locationId ?? "").trim();
    const locationSlug = (body.locationSlug ?? "").trim();
    const businessIdParam = (body.businessId ?? "").trim();
    const businessSlugParam = (body.businessSlug ?? "").trim();
    const name = (body.name ?? "").trim();
    const address = (body.address ?? "").trim() || null;

    console.info("[locations/patch] request", {
      requestedLocationId: locationId || null,
      requestedLocationSlug: locationSlug || null,
      requestedBusinessId: businessIdParam || null,
      requestedBusinessSlug: businessSlugParam || null,
      writtenValues: {
        name,
        address,
      },
    });

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const canUseId = UUID_PATTERN.test(locationId);
    const hasBusinessScope = Boolean(businessIdParam || businessSlugParam);
    const canUseSlug = Boolean(locationSlug);

    if (!canUseId && !canUseSlug) {
      return NextResponse.json(
        {
          error:
            "Provide a valid locationId UUID, or provide locationSlug",
        },
        { status: 400 },
      );
    }

    const updatePayload = {
      name,
      address,
    };

    if (canUseId) {
      const { data, error } = await supabase
        .from("business_locations")
        .update(updatePayload)
        .eq("id", locationId)
        .select("id,business_id,name,slug,address,created_at")
        .maybeSingle<LocationRow>();

      if (!error && data) {
        const location = toLocationResponse(data);
        console.info("[locations/patch] updated-by-id", {
          resolvedLocationId: location.id,
          resolvedLocationSlug: location.slug,
          writtenValues: {
            name: location.name,
            address: location.address,
          },
        });
        return NextResponse.json({
          ok: true,
          location,
        });
      }
    }

    let resolvedBusinessId: string;
    if (hasBusinessScope) {
      try {
        const resolved = await resolveBusinessId({
          supabase,
          businessId: businessIdParam,
          businessSlug: businessSlugParam,
        });
        resolvedBusinessId = resolved.businessId;
      } catch (error) {
        if (error instanceof BusinessResolutionError) {
          const fallback = await resolveSingleMembershipBusinessId(supabase, user.id);
          if ("error" in fallback) {
            return fallback.error;
          }
          resolvedBusinessId = fallback.businessId;
        } else {
          throw error;
        }
      }
    } else {
      const fallback = await resolveSingleMembershipBusinessId(supabase, user.id);
      if ("error" in fallback) {
        return fallback.error;
      }
      resolvedBusinessId = fallback.businessId;
    }

    let data: LocationRow | null = null;
    let error: { message?: string } | null = null;

    if (canUseSlug) {
      const updateBySlug = await supabase
        .from("business_locations")
        .update(updatePayload)
        .eq("business_id", resolvedBusinessId)
        .eq("slug", locationSlug)
        .select("id,business_id,name,slug,address,created_at")
        .maybeSingle<LocationRow>();

      data = updateBySlug.data;
      error = updateBySlug.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update location" }, { status: 500 });
    }

    if (!data) {
      const { data: candidates, error: candidatesError } = await supabase
        .from("business_locations")
        .select("id,business_id,name,slug,address,created_at")
        .eq("business_id", resolvedBusinessId)
        .order("created_at", { ascending: false })
        .returns<LocationRow[]>();

      if (candidatesError) {
        return NextResponse.json({ error: candidatesError.message || "Failed to resolve location" }, { status: 500 });
      }

      const rows = candidates ?? [];
      if (!rows.length) {
        const createFirst = await createLocationDirect({
          supabase,
          userId: user.id,
          businessId: resolvedBusinessId,
          name,
          address,
          sourceLocationId: null,
        });

        if (createFirst.error || !createFirst.data) {
          return NextResponse.json({ error: createFirst.error || "Failed to create location" }, { status: 500 });
        }

        return NextResponse.json({
          ok: true,
          location: createFirst.data,
        });
      }

      let target: LocationRow | undefined;

      const normalizedSlug = normalizeText(locationSlug);
      if (normalizedSlug) {
        target = rows.find((entry) => normalizeText(entry.slug) === normalizedSlug);
      }

      if (!target) {
        const normalizedName = normalizeText(name);
        if (normalizedName) {
          target = rows.find((entry) => normalizeText(entry.name) === normalizedName);
        }
      }

      if (!target && rows.length === 1) {
        target = rows[0];
      }

      if (!target) {
        target = rows[0];
      }

      const retry = await supabase
        .from("business_locations")
        .update(updatePayload)
        .eq("id", target.id)
        .select("id,business_id,name,slug,address,created_at")
        .maybeSingle<LocationRow>();

      if (retry.error) {
        const message = retry.error.message || "Failed to update location";
        const needsBootstrap = /no business membership found/i.test(message);
        if (!needsBootstrap) {
          return NextResponse.json({ error: message }, { status: 500 });
        }

        const bootstrappedBusinessId = await bootstrapMembershipForUser({
          supabase,
          userId: user.id,
          preferredName: name,
        });

        if (!bootstrappedBusinessId) {
          return NextResponse.json({ error: message }, { status: 500 });
        }

        const createViaBootstrap = await supabase.rpc("create_business_location", {
          p_name: name,
          p_address: address,
          p_copy_from_location_id: null,
        });

        if (createViaBootstrap.error) {
          const createFallback = await createLocationDirect({
            supabase,
            userId: user.id,
            businessId: bootstrappedBusinessId,
            name,
            address,
            sourceLocationId: null,
          });

          if (createFallback.error || !createFallback.data) {
            return NextResponse.json({ error: createFallback.error || "Failed to update location" }, { status: 500 });
          }

          return NextResponse.json({
            ok: true,
            businessId: bootstrappedBusinessId,
            location: createFallback.data,
          });
        }

        return NextResponse.json({
          ok: true,
          businessId: bootstrappedBusinessId,
          location: createViaBootstrap.data?.[0] ?? null,
        });
      }

      if (!retry.data) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }

      const location = toLocationResponse(retry.data);
      console.info("[locations/patch] updated-fallback", {
        resolvedLocationId: location.id,
        resolvedLocationSlug: location.slug,
        writtenValues: {
          name: location.name,
          address: location.address,
        },
      });

      return NextResponse.json({
        ok: true,
        location,
      });
    }

    const location = toLocationResponse(data);
    console.info("[locations/patch] updated-by-slug", {
      resolvedLocationId: location.id,
      resolvedLocationSlug: location.slug,
      writtenValues: {
        name: location.name,
        address: location.address,
      },
    });

    return NextResponse.json({
      ok: true,
      location,
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to update location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
