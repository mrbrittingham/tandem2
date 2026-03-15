import type { SupabaseClient } from "@supabase/supabase-js";

type BusinessRow = {
  id: string;
  slug: string | null;
};

export class BusinessResolutionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ResolvedBusiness = {
  businessId: string;
  businessSlug: string | null;
  inputMode: "id" | "slug";
};

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export async function resolveBusinessId(args: {
  supabase: SupabaseClient;
  businessId?: string | null;
  businessSlug?: string | null;
}): Promise<ResolvedBusiness> {
  const slugParam = (args.businessSlug ?? "").trim();
  const idParam = (args.businessId ?? "").trim();

  if (!slugParam && !idParam) {
    throw new BusinessResolutionError("businessSlug or businessId required", 400, "MISSING_BUSINESS_IDENTIFIER");
  }

  if (slugParam) {
    const normalized = normalizeSlug(slugParam);
    const { data, error } = await args.supabase
      .from("businesses")
      .select("id,slug")
      .eq("slug", normalized)
      .limit(1)
      .returns<BusinessRow[]>();

    if (error) {
      throw new BusinessResolutionError(`Failed to resolve business by slug: ${error.message}`, 500, "BUSINESS_RESOLVE_FAILED");
    }

    const business = data?.[0];
    if (!business) {
      // Fallback: the client may be passing a business ID as the slug param.
      const { data: byId, error: idError } = await args.supabase
        .from("businesses")
        .select("id,slug")
        .eq("id", normalized)
        .limit(1)
        .returns<BusinessRow[]>();

      if (idError) {
        throw new BusinessResolutionError(`Failed to resolve business: ${idError.message}`, 500, "BUSINESS_RESOLVE_FAILED");
      }

      const fallback = byId?.[0];
      if (fallback) {
        return {
          businessId: fallback.id,
          businessSlug: fallback.slug,
          inputMode: "slug",
        };
      }

      throw new BusinessResolutionError("Business not found", 404, "BUSINESS_NOT_FOUND");
    }

    return {
      businessId: business.id,
      businessSlug: business.slug,
      inputMode: "slug",
    };
  }

  if (idParam) {
    const { data, error } = await args.supabase
      .from("businesses")
      .select("id,slug")
      .eq("id", idParam)
      .limit(1)
      .returns<BusinessRow[]>();

    if (error) {
      throw new BusinessResolutionError(`Failed to resolve business by id: ${error.message}`, 500, "BUSINESS_RESOLVE_FAILED");
    }

    const business = data?.[0];
    if (!business) {
      const normalized = normalizeSlug(idParam);
      const bySlug = await args.supabase
        .from("businesses")
        .select("id,slug")
        .eq("slug", normalized)
        .limit(1)
        .returns<BusinessRow[]>();

      if (bySlug.error) {
        throw new BusinessResolutionError(`Failed to resolve business by slug: ${bySlug.error.message}`, 500, "BUSINESS_RESOLVE_FAILED");
      }

      if (bySlug.data?.[0]) {
        return {
          businessId: bySlug.data[0].id,
          businessSlug: bySlug.data[0].slug,
          inputMode: "slug",
        };
      }

      // Business IDs are opaque text in production; keep provided ID for downstream membership/location checks.
      return {
        businessId: idParam,
        businessSlug: null,
        inputMode: "id",
      };
    }

    return {
      businessId: business.id,
      businessSlug: business.slug,
      inputMode: "id",
    };
  }

  throw new BusinessResolutionError("businessSlug or businessId required", 400, "MISSING_BUSINESS_IDENTIFIER");
}
