export type Industry =
  | "restaurant"
  | "hospitality"
  | "retail"
  | "services"
  | "wellness"
  | string;

export type OperatingHoursBlock = {
  id: string;
  label: string;
  days: string[];
  open: string;
  close: string;
};

export type ContactMethodType = "phone" | "email" | "sms" | "link" | "form";

export type ContactMethod = {
  id: string;
  type: ContactMethodType;
  label: string;
  value: string;
  enabled: boolean;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  showInHelp: boolean;
  updatedAt: string;
};

export type PolicyItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  showInHelp: boolean;
  updatedAt: string;
};

export type IntegrationConfig = {
  id: string;
  name: string;
  category: string;
  status: "not_connected" | "connected" | "syncing";
  description: string;
  credentialLabel: string;
  lastSynced?: string;
  notes?: string;
};

export type IntentRoute =
  | { type: "knowledge"; refId?: string }
  | { type: "link"; url: string }
  | { type: "handoff"; channelId?: string; note?: string };

export type Intent = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  route: IntentRoute;
  lastUpdated: string;
};

export type WidgetThemeSettings = {
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
};

export type HandoffConfig = {
  headline: string;
  status: "online" | "offline";
  statusDetail: string;
  supportHoursLabel: string;
  contactMethods: ContactMethod[];
  offlineMessage: string;
};

export type BusinessProfile = {
  id: string;
  slug: string;
  name: string;
  industry: Industry;
  timezone: string;
  tagline: string;
  summary: string;
  location: string;
  contacts: ContactMethod[];
  hours: OperatingHoursBlock[];
  intents: Intent[];
  faqs: FAQItem[];
  policies: PolicyItem[];
  integrations: IntegrationConfig[];
  theme: WidgetThemeSettings;
  handoff: HandoffConfig;
  createdAt: string;
  updatedAt: string;
};

export type MockState = {
  businesses: BusinessProfile[];
  activeBusinessId?: string;
};

export type CreateBusinessPayload = {
  name: string;
  industry: Industry;
  timezone: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  brandColor?: string;
  summary?: string;
  supportHoursLabel?: string;
};

export type WidgetSuggestedIntent = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  routeType: IntentRoute["type"];
  routeHint?: string;
};

export type WidgetFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

export type WidgetHelpCategory = {
  id: string;
  label: string;
  description?: string;
};

export type WidgetHandoffDisplay = {
  label: string;
  status: "online" | "offline";
  detail: string;
  actionLabel: string;
  actionValue: string;
};

export type WidgetContentConfig = {
  businessName: string;
  tagline?: string;
  welcomeMessage?: string;
  intents: WidgetSuggestedIntent[];
  faqs: WidgetFaq[];
  categories: WidgetHelpCategory[];
  handoff: WidgetHandoffDisplay;
};
