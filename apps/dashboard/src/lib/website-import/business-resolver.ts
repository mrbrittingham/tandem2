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
  inputMode: "uuid" | "slug";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return UUID_PATTERN.test(value.trim());
}

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
  const identifier = slugParam || idParam;

  if (!identifier) {
    throw new BusinessResolutionError("businessSlug or businessId required", 400, "MISSING_BUSINESS_IDENTIFIER");
  }

  if (isUuid(identifier)) {
    const { data, error } = await args.supabase
      .from("businesses")
      .select("id,slug")
      .eq("id", identifier)
      .limit(1)
      .returns<BusinessRow[]>();

    if (error) {
      throw new BusinessResolutionError(`Failed to resolve business by id: ${error.message}`, 500, "BUSINESS_RESOLVE_FAILED");
    }

    const business = data?.[0];
    if (!business) {
      throw new BusinessResolutionError("Business not found", 404, "BUSINESS_NOT_FOUND");
    }

    return {
      businessId: business.id,
      businessSlug: business.slug,
      inputMode: "uuid",
    };
  }

  const normalized = normalizeSlug(identifier);
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
    throw new BusinessResolutionError("Business not found", 404, "BUSINESS_NOT_FOUND");
  }

  return {
    businessId: business.id,
    businessSlug: business.slug,
    inputMode: "slug",
  };
}
