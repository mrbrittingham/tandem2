export type WidgetRuntimeConfigInput = {
  businessId?: string;
  locationSlug?: string;
  apiBaseUrl?: string;
};

export type WidgetRuntimeConfig = {
  businessId?: string;
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
  const locationSlug = normalizeSlug(input.locationSlug);
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);

  if (!businessId) {
    return {
      businessId: undefined,
      locationSlug,
      apiBaseUrl,
      isValid: false,
      error: "ChatWidget requires a businessId.",
    };
  }

  return {
    businessId,
    locationSlug,
    apiBaseUrl,
    isValid: true,
  };
}
