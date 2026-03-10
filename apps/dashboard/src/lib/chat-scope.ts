import type { BusinessProfile } from "@tandem/shared";

export type ChatScope = {
  businessId?: string;
  businessSlug?: string;
  locationId?: string;
  locationSlug?: string;
};

export function resolveChatScope(location?: BusinessProfile): ChatScope {
  if (!location) {
    return {};
  }

  const businessSlug = (location.businessSlug ?? location.slug ?? "").trim() || undefined;
  const locationSlug = (location.locationSlug ?? location.slug ?? "").trim() || undefined;

  return {
    businessId: businessSlug,
    businessSlug,
    locationId: (location.id ?? "").trim() || undefined,
    locationSlug,
  };
}

export function resolveLocationLabel(location?: BusinessProfile): string {
  return location?.locationName ?? location?.location ?? "Select a location";
}
