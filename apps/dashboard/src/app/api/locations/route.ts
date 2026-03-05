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

    const { data, error } = await query.returns<LocationRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load locations" }, { status: 500 });
    }

    const filtered = ENABLE_DEMO_DATA
      ? (data ?? [])
      : (data ?? []).filter((location) => !isLegacyDemoLocation(location));

    return NextResponse.json({
      locations: filtered.map((location) => ({
        id: location.id,
        businessId: location.business_id,
        name: location.name,
        slug: location.slug,
        address: location.address,
        createdAt: location.created_at,
      })),
    });
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

    const firstAttempt = await supabase.rpc("create_business_location", {
      p_name: name,
      p_address: address,
      p_copy_from_location_id: mode === "copy" ? sourceLocationId : null,
    });

    if (firstAttempt.error) {
      const message = firstAttempt.error.message || "Failed to create location";
      const needsBootstrap = /no business membership found/i.test(message);

      if (!needsBootstrap) {
        return NextResponse.json({ error: message }, { status: 500 });
      }

      const bootstrappedBusinessId = await bootstrapMembershipForUser({
        supabase,
        userId: user.id,
        preferredName: businessName || name,
      });

      if (!bootstrappedBusinessId) {
        return NextResponse.json({ error: message }, { status: 500 });
      }

      const retry = await supabase.rpc("create_business_location", {
        p_name: name,
        p_address: address,
        p_copy_from_location_id: mode === "copy" ? sourceLocationId : null,
      });

      if (retry.error) {
        return NextResponse.json({ error: retry.error.message || "Failed to create location" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        businessId: bootstrappedBusinessId,
        location: retry.data?.[0] ?? null,
      });
    }

    return NextResponse.json({ ok: true, location: firstAttempt.data?.[0] ?? null });
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
        return NextResponse.json({
          ok: true,
          location: {
            id: data.id,
            businessId: data.business_id,
            business_id: data.business_id,
            name: data.name,
            slug: data.slug,
            address: data.address,
            createdAt: data.created_at,
          },
        });
      }
    }

    if (!canUseSlug) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
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

    const { data, error } = await supabase
      .from("business_locations")
      .update(updatePayload)
      .eq("business_id", resolvedBusinessId)
      .eq("slug", locationSlug)
      .select("id,business_id,name,slug,address,created_at")
      .maybeSingle<LocationRow>();

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
        const createFirst = await supabase.rpc("create_business_location", {
          p_name: name,
          p_address: address,
          p_copy_from_location_id: null,
        });

        if (createFirst.error) {
          return NextResponse.json({ error: createFirst.error.message || "Failed to create location" }, { status: 500 });
        }

        return NextResponse.json({
          ok: true,
          location: createFirst.data?.[0] ?? null,
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
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
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
          return NextResponse.json({ error: createViaBootstrap.error.message || "Failed to update location" }, { status: 500 });
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

      return NextResponse.json({
        ok: true,
        location: {
          id: retry.data.id,
          businessId: retry.data.business_id,
          business_id: retry.data.business_id,
          name: retry.data.name,
          slug: retry.data.slug,
          address: retry.data.address,
          createdAt: retry.data.created_at,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      location: {
        id: data.id,
        businessId: data.business_id,
        business_id: data.business_id,
        name: data.name,
        slug: data.slug,
        address: data.address,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    if (error instanceof BusinessResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to update location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
