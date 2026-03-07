import type { WebsiteImportDraft } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isClaim(value: unknown): value is { value: string | null; sourceUrl: string | null; confidence?: number } {
  if (!isObject(value)) {
    return false;
  }
  if (!isNullableString(value.value) || !isNullableString(value.sourceUrl)) {
    return false;
  }
  if (value.confidence !== undefined && typeof value.confidence !== "number") {
    return false;
  }
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isWebsiteImportDraft(value: unknown): value is WebsiteImportDraft {
  if (!isObject(value)) {
    return false;
  }

  if (!isString(value.sourceUrl)) {
    return false;
  }

  if (!isObject(value.businessProfile)) {
    return false;
  }
  if (!isClaim(value.businessProfile.name)) return false;
  if (!isClaim(value.businessProfile.shortDescription)) return false;
  if (!isClaim(value.businessProfile.phone)) return false;
  if (!isClaim(value.businessProfile.email)) return false;
  if (!isClaim(value.businessProfile.address)) return false;
  if (!isClaim(value.businessProfile.hours)) return false;
  if (!Array.isArray(value.businessProfile.socialLinks)) return false;

  if (!Array.isArray(value.faqs) || !Array.isArray(value.policies)) {
    return false;
  }

  if (!Array.isArray(value.pageClassification)) {
    return false;
  }

  if (!isObject(value.restaurantKnowledge)) {
    return false;
  }

  if (!Array.isArray(value.restaurantKnowledge.events)) {
    return false;
  }

  if (!Array.isArray(value.restaurantKnowledge.menuSections)) {
    return false;
  }

  if (!isObject(value.restaurantKnowledge.reservations) || !isObject(value.restaurantKnowledge.memberships)) {
    return false;
  }

  if (!isNullableString(value.restaurantKnowledge.reservations.sourceUrl)) {
    return false;
  }

  if (!isNullableString(value.restaurantKnowledge.reservations.bookingUrl)) {
    return false;
  }

  if (!isStringArray(value.restaurantKnowledge.reservations.platforms)) {
    return false;
  }

  if (!isNullableString(value.restaurantKnowledge.memberships.sourceUrl)) {
    return false;
  }

  if (!isNullableString(value.restaurantKnowledge.memberships.signupUrl)) {
    return false;
  }

  if (!isObject(value.brand)) {
    return false;
  }
  if (!isClaim(value.brand.primaryColor)) return false;
  if (!isClaim(value.brand.accentColor)) return false;
  if (!isClaim(value.brand.backgroundColor)) return false;
  if (!isClaim(value.brand.textColor)) return false;
  if (!isClaim(value.brand.fontFamily)) return false;
  if (!isClaim(value.brand.logoUrl)) return false;

  if (!isObject(value.evidence) || !Array.isArray(value.evidence.pages)) {
    return false;
  }

  return true;
}
