import type { BusinessProfile } from "@tandem/shared";

export type ChatScope = {
  businessId?: string;
  locationSlug?: string;
};

export function resolveChatScope(location?: BusinessProfile): ChatScope {
  if (!location) {
    return {};
  }

  const businessId = (location.businessSlug ?? location.slug ?? "").trim() || undefined;
  const locationSlug = (location.locationSlug ?? location.slug ?? "").trim() || undefined;

  return {
    businessId,
    locationSlug,
  };
}

export function resolveLocationLabel(location?: BusinessProfile): string {
  return location?.locationName ?? location?.location ?? "Select a location";
}
