export type WidgetRuntimeConfigInput = {
  businessId?: string;
  businessSlug?: string;
  locationId?: string;
  locationSlug?: string;
  apiBaseUrl?: string;
};

export type WidgetRuntimeConfig = {
  businessId?: string;
  businessSlug?: string;
  locationId?: string;
  locationSlug?: string;
  apiBaseUrl: string;
  isValid: boolean;
  error?: string;
};

function normalizeApiBaseUrl(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeSlug(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveWidgetRuntimeConfig(input: WidgetRuntimeConfigInput): WidgetRuntimeConfig {
  const businessId = normalizeSlug(input.businessId);
  const businessSlug = normalizeSlug(input.businessSlug);
  const locationId = normalizeSlug(input.locationId);
  const locationSlug = normalizeSlug(input.locationSlug);
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);

  if (!businessId && !businessSlug) {
    return {
      businessId: undefined,
      businessSlug: undefined,
      locationId,
      locationSlug,
      apiBaseUrl,
      isValid: false,
      error: "ChatWidget requires businessId or businessSlug.",
    };
  }

  if (!locationId && !locationSlug) {
    return {
      businessId,
      businessSlug,
      locationId: undefined,
      locationSlug: undefined,
      apiBaseUrl,
      isValid: false,
      error: "ChatWidget requires locationId or locationSlug.",
    };
  }

  return {
    businessId,
    businessSlug,
    locationId,
    locationSlug,
    apiBaseUrl,
    isValid: true,
  };
}
