import type { BusinessProfile, FAQItem, Intent, IntegrationConfig, PolicyItem, WidgetThemeSettings, HandoffConfig } from "@tandem/shared";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function inferLocationScope(location: BusinessProfile) {
  return {
    locationId: location.id,
    locationSlug: location.locationSlug ?? location.slug,
    businessId: location.businessSlug,
  };
}

export async function saveLocationConfig(args: {
  location: BusinessProfile;
  assistantConfig?: Record<string, unknown>;
  knowledgeConfig?: Record<string, unknown>;
  handoffConfig?: Record<string, unknown>;
  widgetConfig?: Record<string, unknown>;
  integrationsConfig?: Record<string, unknown>;
}) {
  const scope = inferLocationScope(args.location);
  const response = await fetch("/api/location-config", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...scope,
      assistantConfig: args.assistantConfig,
      knowledgeConfig: args.knowledgeConfig,
      handoffConfig: args.handoffConfig,
      widgetConfig: args.widgetConfig,
      integrationsConfig: args.integrationsConfig,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Failed to save changes");
  }

  return response.json();
}

export type LocationConfigHydration = {
  widgetTheme?: WidgetThemeSettings;
  faqs?: FAQItem[];
  policies?: PolicyItem[];
  handoff?: HandoffConfig;
  intents?: Intent[];
  integrations?: IntegrationConfig[];
};

export function parseLocationConfigForHydration(config: unknown): LocationConfigHydration {
  const root = asObject(config);
  const widgetConfig = asObject(root.widgetConfig);
  const knowledgeConfig = asObject(root.knowledgeConfig);
  const assistantConfig = asObject(root.assistantConfig);
  const handoffConfig = asObject(root.handoffConfig);
  const integrationsConfig = asObject(root.integrationsConfig);

  const themeCandidate = asObject(widgetConfig.theme);
  const importedFaqs = Array.isArray(knowledgeConfig.faqs)
    ? knowledgeConfig.faqs
    : Array.isArray(knowledgeConfig.importedFaqs)
      ? knowledgeConfig.importedFaqs
      : [];
  const importedPolicies = Array.isArray(knowledgeConfig.policies)
    ? knowledgeConfig.policies
    : Array.isArray(knowledgeConfig.importedPolicies)
      ? knowledgeConfig.importedPolicies
      : [];

  return {
    widgetTheme: Object.keys(themeCandidate).length ? (themeCandidate as WidgetThemeSettings) : undefined,
    faqs: importedFaqs as FAQItem[],
    policies: importedPolicies as PolicyItem[],
    handoff: Object.keys(handoffConfig).length ? (handoffConfig as unknown as HandoffConfig) : undefined,
    intents: Array.isArray(assistantConfig.intents) ? (assistantConfig.intents as Intent[]) : undefined,
    integrations: Array.isArray(integrationsConfig.integrations)
      ? (integrationsConfig.integrations as IntegrationConfig[])
      : undefined,
  };
}
