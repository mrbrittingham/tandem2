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

  const businessId = ((location as BusinessProfile & { businessId?: string }).businessId ?? "").trim() || undefined;
  const businessSlug = (location.businessSlug ?? location.slug ?? "").trim() || undefined;
  const locationId = ((location as BusinessProfile & { locationId?: string }).locationId ?? "").trim() || undefined;
  const locationSlug = (location.locationSlug ?? location.slug ?? "").trim() || undefined;

  return {
    businessId,
    businessSlug,
    locationId,
    locationSlug,
  };
}

export function resolveLocationLabel(location?: BusinessProfile): string {
  return location?.locationName ?? location?.location ?? "Select a location";
}
