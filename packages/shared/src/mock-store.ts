import type {
  BusinessProfile,
  ContactMethod,
  CreateBusinessPayload,
  CreateLocationPayload,
  FAQItem,
  HandoffConfig,
  Industry,
  IntegrationConfig,
  Intent,
  IntentRoute,
  MockState,
  OperatingHoursBlock,
  PolicyItem,
  WidgetContentConfig,
  WidgetFaq,
  WidgetHelpCategory,
} from "./types";

 type Listener = (snapshot: MockState) => void;

 const STORAGE_KEY = "tandem:mock-state";

 const listeners = new Set<Listener>();
 let state: MockState = initializeState();

 function initializeState(): MockState {
  if (typeof window !== "undefined") {
    const fromStorage = readFromStorage();
    if (fromStorage) {
      return fromStorage;
    }
  }
  return createDefaultState();
 }

 function readFromStorage(): MockState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as MockState;
    if (parsed && Array.isArray(parsed.businesses)) {
      if (!parsed.accountBusinessName && parsed.businesses[0]) {
        parsed.accountBusinessName = parsed.businesses[0].businessName ?? parsed.businesses[0].name;
      }
      if (!parsed.accountBusinessSlug && parsed.businesses[0]) {
        parsed.accountBusinessSlug = parsed.businesses[0].businessSlug ?? slugify(parsed.businesses[0].name);
      }
      if (!parsed.activeLocationId) {
        parsed.activeLocationId = parsed.activeBusinessId ?? parsed.businesses[0]?.id;
      }
      if (!parsed.activeBusinessId) {
        parsed.activeBusinessId = parsed.activeLocationId;
      }
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to read mock state", error);
  }
  return null;
 }

 function persistState(next: MockState) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Failed to persist mock state", error);
  }
 }

 function notify() {
  listeners.forEach((listener) => listener(state));
 }

 function cloneState(): MockState {
  return JSON.parse(JSON.stringify(state)) as MockState;
 }

 export function getMockState(): MockState {
  return state;
 }

 export function subscribeToMockState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
 }

 export function updateMockState(mutator: (draft: MockState) => void) {
  const draft = cloneState();
  mutator(draft);
  state = draft;
  persistState(state);
  notify();
 }

 export function resetMockState(next?: MockState) {
  state = next ?? createDefaultState();
  persistState(state);
  notify();
 }

export function getLocations(snapshot: MockState = state): BusinessProfile[] {
  return snapshot.businesses;
}

export function getActiveLocation(snapshot: MockState = state): BusinessProfile | undefined {
  const { businesses } = snapshot;
  const activeLocationId = snapshot.activeLocationId ?? snapshot.activeBusinessId;
  if (!businesses.length) {
    return undefined;
  }
  return businesses.find((entry) => entry.id === activeLocationId) ?? businesses[0];
}

export function selectActiveLocation(locationId: string) {
  updateMockState((draft) => {
    draft.activeLocationId = locationId;
    draft.activeBusinessId = locationId;
  });
}

 export function getActiveBusiness(snapshot: MockState = state): BusinessProfile | undefined {
  return getActiveLocation(snapshot);
 }

 export function selectActiveBusiness(businessId: string) {
  selectActiveLocation(businessId);
 }

export function createLocation(payload: CreateLocationPayload): BusinessProfile {
  const source = payload.mode === "copy"
    ? getLocations().find((entry) => entry.id === payload.sourceLocationId)
    : undefined;
  const template = source ? cloneLocation(source) : buildIndustryTemplate(getAccountIndustry());
  const timestamp = new Date().toISOString();
  const businessName = state.accountBusinessName ?? template.businessName ?? template.name;
  const businessSlug = state.accountBusinessSlug ?? template.businessSlug ?? slugify(businessName);
  const locationName = payload.name.trim() || "New location";

  const location: BusinessProfile = {
    ...template,
    id: createId(),
    slug: `${businessSlug}-${slugify(locationName)}`,
    name: businessName,
    businessName,
    businessSlug,
    locationName,
    locationSlug: slugify(locationName),
    location: payload.address?.trim() || source?.location || "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  updateMockState((draft) => {
    draft.accountBusinessName = businessName;
    draft.accountBusinessSlug = businessSlug;
    draft.businesses.push(location);
    draft.activeLocationId = location.id;
    draft.activeBusinessId = location.id;
  });

  return location;
}

 export function createBusiness(payload: CreateBusinessPayload): BusinessProfile {
  const template = buildIndustryTemplate(payload.industry);
  const timestamp = new Date().toISOString();
  const businessName = payload.name;
  const businessSlug = slugify(payload.name);
  const locationName = "Main location";
  const business: BusinessProfile = {
    ...template,
    id: createId(),
    slug: `${businessSlug}-${slugify(locationName)}`,
    name: businessName,
    businessName,
    businessSlug,
    locationName,
    locationSlug: slugify(locationName),
    industry: payload.industry,
    timezone: payload.timezone,
    tagline: template.tagline.replace(template.name, businessName),
    summary: payload.summary ?? template.summary.replace(template.name, businessName),
    contacts: mergeContacts(payload, template.contacts),
    theme: {
      ...template.theme,
      primaryColor: payload.brandColor ?? template.theme.primaryColor,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (payload.supportHoursLabel) {
    business.handoff.supportHoursLabel = payload.supportHoursLabel;
    business.handoff.statusDetail = payload.supportHoursLabel;
  }

  business.handoff.contactMethods.unshift({
    id: createId(),
    type: "email",
    label: `${payload.contactName} inbox`,
    value: payload.contactEmail,
    enabled: true,
  });

  if (payload.contactPhone) {
    business.handoff.contactMethods.unshift({
      id: createId(),
      type: "phone",
      label: "Primary phone",
      value: payload.contactPhone,
      enabled: true,
    });
  }

  updateMockState((draft) => {
    draft.accountBusinessName = businessName;
    draft.accountBusinessSlug = businessSlug;
    draft.businesses = [business];
    draft.activeLocationId = business.id;
    draft.activeBusinessId = business.id;
  });

  return business;
 }

 export function updateBusiness(
  businessId: string,
  updater: (business: BusinessProfile) => void,
 ) {
  updateMockState((draft) => {
    const business = draft.businesses.find((entry) => entry.id === businessId);
    if (!business) {
      return;
    }
    updater(business);
    business.updatedAt = new Date().toISOString();
  });
 }

 export function businessToWidgetConfig(business: BusinessProfile): WidgetContentConfig {
  const enabledFaqs = business.faqs.filter((faq) => faq.showInHelp);
  const policyFaqs = business.policies
    .filter((policy) => policy.showInHelp)
    .map((policy) => ({
      id: policy.id,
      question: policy.title,
      answer: policy.description,
      category: policy.category || "Policies",
    } satisfies WidgetFaq));

  const faqs: WidgetFaq[] = [...enabledFaqs.map(mapFaqToWidget), ...policyFaqs];
  const categories = buildFaqCategories(faqs);
  const handoffMethod = business.handoff.contactMethods.find((method) => method.enabled);

  return {
    businessName: business.businessName ?? business.name,
    tagline: buildWidgetLocationSubtitle(business),
    welcomeMessage: business.summary,
    intents: business.intents.map((intent) => ({
      id: intent.id,
      label: intent.label,
      description: intent.description,
      prompt: intent.prompt,
      routeType: intent.route.type,
      routeHint: describeRoute(intent.route),
    })),
    faqs,
    categories,
    handoff: {
      label: business.handoff.headline,
      status: business.handoff.status,
      detail: business.handoff.statusDetail || business.handoff.supportHoursLabel,
      actionLabel: handoffMethod ? formatContactLabel(handoffMethod.type) : "Leave a message",
      actionValue: handoffMethod?.value ?? "",
    },
  };
 }

function buildWidgetLocationSubtitle(business: BusinessProfile): string {
  const cityState = extractCityState(business.location);
  if (cityState) {
    return cityState;
  }

  const locationName = (business.locationName ?? "").trim();
  if (locationName) {
    return locationName;
  }

  return "Location details";
}

function extractCityState(address: string): string | null {
  const normalized = address.trim();
  if (!normalized) {
    return null;
  }

  const usCityStateMatch = normalized.match(/,\s*([^,]+),\s*([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*(?:US|USA|United States))?\s*$/i);
  if (usCityStateMatch) {
    const city = usCityStateMatch[1].trim();
    const state = usCityStateMatch[2].trim().toUpperCase();
    if (city && state) {
      return `${city}, ${state}`;
    }
  }

  const parts = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (parts.length >= 2) {
    const city = parts[parts.length - 1];
    if (city) {
      return city;
    }
  }

  return null;
}

 function mapFaqToWidget(faq: FAQItem): WidgetFaq {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
  };
 }

 function describeRoute(route: IntentRoute): string | undefined {
  if (route.type === "link") {
    return route.url;
  }
  if (route.type === "handoff") {
    return route.note ?? "Escalates to a person";
  }
  return undefined;
 }

 function buildFaqCategories(faqs: WidgetFaq[]): WidgetHelpCategory[] {
  const seen = new Map<string, WidgetHelpCategory>();
  faqs.forEach((faq) => {
    if (!seen.has(faq.category)) {
      seen.set(faq.category, {
        id: slugify(faq.category),
        label: faq.category,
        description: defaultCategoryDescription(faq.category),
      });
    }
  });
  return Array.from(seen.values());
 }

 function defaultCategoryDescription(category: string) {
  if (/parking/i.test(category)) {
    return "Arrival logistics and parking guidance.";
  }
  if (/diet|allerg/i.test(category)) {
    return "Dietary accommodations and menu notes.";
  }
  if (/policy|rules/i.test(category)) {
    return "House rules and guest policies.";
  }
  return `Details about ${category.toLowerCase()}.`;
 }

 function formatContactLabel(type: ContactMethod["type"]) {
  switch (type) {
    case "phone":
      return "Call the team";
    case "email":
      return "Email the team";
    case "sms":
      return "Text us";
    case "form":
      return "Open form";
    default:
      return "Open link";
  }
 }

 function mergeContacts(
  payload: CreateBusinessPayload,
  templateContacts: ContactMethod[],
 ): ContactMethod[] {
  const contacts: ContactMethod[] = [];
  contacts.push({
    id: createId(),
    type: "email",
    label: `${payload.contactName} · primary`,
    value: payload.contactEmail,
    enabled: true,
  });
  if (payload.contactPhone) {
    contacts.push({
      id: createId(),
      type: "phone",
      label: "Front desk",
      value: payload.contactPhone,
      enabled: true,
    });
  }
  templateContacts.forEach((contact) => {
    contacts.push({ ...contact, id: createId() });
  });
  return contacts;
 }

 function buildIndustryTemplate(industry: Industry): BusinessProfile {
  switch (industry) {
    case "retail":
      return createRetailTemplate();
    case "services":
    case "wellness":
    case "salon":
      return createSalonTemplate();
    default:
      return createRestaurantTemplate();
  }
 }

function getAccountIndustry(): Industry {
  return getActiveLocation()?.industry ?? "restaurant";
}

function cloneLocation(source: BusinessProfile): BusinessProfile {
  const cloned = JSON.parse(JSON.stringify(source)) as BusinessProfile;
  cloned.hours = cloned.hours.map((entry) => ({ ...entry, id: createId() }));
  cloned.contacts = cloned.contacts.map((entry) => ({ ...entry, id: createId() }));
  cloned.intents = cloned.intents.map((entry) => ({ ...entry, id: createId() }));
  cloned.faqs = cloned.faqs.map((entry) => ({ ...entry, id: createId() }));
  cloned.policies = cloned.policies.map((entry) => ({ ...entry, id: createId() }));
  cloned.integrations = cloned.integrations.map((entry) => ({ ...entry, id: createId() }));
  cloned.handoff = {
    ...cloned.handoff,
    contactMethods: cloned.handoff.contactMethods.map((entry) => ({ ...entry, id: createId() })),
  };
  return cloned;
}

 function createDefaultState(): MockState {
  const location = createRestaurantTemplate();
  const secondLocation = cloneLocation(location);
  secondLocation.id = createId();
  secondLocation.locationName = "Mission Bay";
  secondLocation.locationSlug = "mission-bay";
  secondLocation.slug = `${location.businessSlug ?? location.slug}-mission-bay`;
  secondLocation.location = "500 Terry Francine St, San Francisco";
  secondLocation.updatedAt = new Date().toISOString();

  return {
    accountBusinessName: location.businessName ?? location.name,
    accountBusinessSlug: location.businessSlug ?? slugify(location.name),
    businesses: [location, secondLocation],
    activeLocationId: location.id,
    activeBusinessId: location.id,
  };
 }

 function createRestaurantTemplate(): BusinessProfile {
  const name = "Cedar & Sage";
  const timezone = "America/Los_Angeles";
  const timestamp = new Date().toISOString();
  const contacts = buildContacts([
    {
      type: "email",
      label: "Concierge",
      value: "concierge@cedarandsage.com",
      enabled: true,
    },
    {
      type: "phone",
      label: "Front desk",
      value: "+1 (415) 555-0198",
      enabled: true,
    },
  ]);

  const handoffContacts = buildContacts([
    {
      type: "phone",
      label: "Call concierge",
      value: "+1 (415) 555-0198",
      enabled: true,
    },
    {
      type: "email",
      label: "Email concierge",
      value: "hello@cedarandsage.com",
      enabled: true,
    },
  ]);

  return {
    id: createId(),
    slug: slugify(name),
    name,
    businessName: name,
    businessSlug: slugify(name),
    locationName: "Valencia St",
    locationSlug: "valencia-st",
    industry: "restaurant",
    timezone,
    tagline: "Concierge for the tasting room",
    summary: "Cedar & Sage pairs a seasonal tasting menu with a warm concierge team ready to answer questions and book experiences.",
    location: "980 Valencia St, San Francisco",
    contacts,
    hours: buildHours([
      {
        label: "Dinner",
        days: ["Tue", "Wed", "Thu", "Sun"],
        open: "17:00",
        close: "22:00",
      },
      {
        label: "Late dinner",
        days: ["Fri", "Sat"],
        open: "17:00",
        close: "23:00",
      },
    ]),
    intents: buildIntents([
      {
        label: "Hours & location",
        description: "Directions, parking, and last seating times.",
        prompt: "What are your hours and where are you located?",
        route: { type: "knowledge" },
      },
      {
        label: "Menu",
        description: "Tonight's tasting line-up and wine pairings.",
        prompt: "Show me the current tasting menu.",
        route: { type: "knowledge" },
      },
      {
        label: "Reservations",
        description: "Hold a table or join the waitlist.",
        prompt: "I'd like to make a reservation.",
        route: { type: "handoff", note: "Route to concierge" },
      },
      {
        label: "Allergies",
        description: "Dietary and allergy accommodations.",
        prompt: "Can you cook for celiac or nut allergies?",
        route: { type: "knowledge" },
      },
      {
        label: "Private dining",
        description: "Suites for events and buyouts.",
        prompt: "Tell me about private dining.",
        route: { type: "link", url: "https://cedarandsage.com/private" },
      },
      {
        label: "Talk to a person",
        description: "Chat with the concierge team.",
        prompt: "Connect me to a person.",
        route: { type: "handoff" },
      },
    ]),
    faqs: buildFaqs([
      {
        question: "Do you accept walk-ins?",
        answer: "We hold a few bar seats for walk-ins each night. Tap 'Reservations' to join the waitlist if we're full.",
        category: "Reservations",
      },
      {
        question: "Is there parking nearby?",
        answer: "There's a garage on 21st & Valencia plus limited street parking after 6pm. Ride shares can use the red zone out front.",
        category: "Parking",
      },
      {
        question: "Can you accommodate allergies?",
        answer: "Yes—our chef team regularly prepares gluten-free, dairy-free, vegan, and nut-free versions with 48 hours notice.",
        category: "Dietary",
      },
      {
        question: "Do you sell gift cards?",
        answer: "Digital gift cards are available year-round and arrive instantly via email.",
        category: "Gift cards",
      },
    ]),
    policies: buildPolicies([
      {
        title: "Cancellation",
        description: "Plans change—we just need 24 hours notice to release your table.",
        category: "Policies",
      },
      {
        title: "Dress code",
        description: "Smart casual is perfect. Jackets and ties are optional.",
        category: "Policies",
      },
      {
        title: "Accessibility",
        description: "Elevator access is available from the lobby plus step-free restrooms.",
        category: "Accessibility",
      },
    ]),
    integrations: buildIntegrations([
      {
        name: "Resy",
        category: "Reservations",
        status: "connected",
        description: "Sync availability and send reservation confirmations.",
        credentialLabel: "Venue ID",
        lastSynced: timestamp,
        notes: "Syncs nightly",
      },
      {
        name: "Toast POS",
        category: "POS",
        status: "not_connected",
        description: "Import menu sections to keep answers current.",
        credentialLabel: "API token",
      },
      {
        name: "Uber Eats",
        category: "Delivery",
        status: "not_connected",
        description: "Status updates and menu parity for delivery guests.",
        credentialLabel: "Store ID",
      },
    ]),
    theme: {
      primaryColor: "#7C3AED",
      accentColor: "#F97316",
      surfaceColor: "#05060A",
      textPrimaryColor: "#F4F4F5",
      textSecondaryColor: "#A1A1AA",
      fontFamily: "'Geist', sans-serif",
      logoUrl: "https://images.unsplash.com/photo-1528605105345-5344ea20e269?w=200&h=200&crop=faces&auto=format",
    },
    handoff: createHandoff(
      {
        headline: "Concierge team",
        status: "online",
        statusDetail: "Typically replies within 2 minutes",
        supportHoursLabel: "Live daily · 10a-10p PT",
        offlineMessage: "We're offline right now—leave your preferred contact and we'll reply shortly.",
        contactMethods: handoffContacts,
      },
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
 }

 function createSalonTemplate(): BusinessProfile {
  const name = "Studio Lumen";
  const timezone = "America/New_York";
  const timestamp = new Date().toISOString();
  const contacts = buildContacts([
    {
      type: "email",
      label: "Bookings",
      value: "hello@studiolumen.com",
      enabled: true,
    },
    {
      type: "phone",
      label: "Front desk",
      value: "+1 (212) 555-0142",
      enabled: true,
    },
  ]);

  const handoffContacts = buildContacts([
    {
      type: "email",
      label: "Email stylist",
      value: "concierge@studiolumen.com",
      enabled: true,
    },
    {
      type: "sms",
      label: "Text confirmations",
      value: "+1 (917) 555-0180",
      enabled: true,
    },
  ]);

  return {
    id: createId(),
    slug: slugify(name),
    name,
    businessName: name,
    businessSlug: slugify(name),
    locationName: "Orchard St",
    locationSlug: "orchard-st",
    industry: "services",
    timezone,
    tagline: "Concierge for appointment-driven teams",
    summary: "Studio Lumen modernizes salon appointments with memberships, stylists on-demand, and proactive reminders.",
    location: "142 Orchard St, New York",
    contacts,
    hours: buildHours([
      {
        label: "Weekday",
        days: ["Tue", "Wed", "Thu", "Fri"],
        open: "09:00",
        close: "20:00",
      },
      {
        label: "Weekend",
        days: ["Sat", "Sun"],
        open: "10:00",
        close: "18:00",
      },
    ]),
    intents: buildIntents([
      {
        label: "Book an appointment",
        description: "Cuts, color, and treatment bookings.",
        prompt: "I want to book an appointment.",
        route: { type: "handoff", note: "Routes to desk" },
      },
      {
        label: "Pricing",
        description: "Menu pricing and memberships.",
        prompt: "What are your pricing options?",
        route: { type: "knowledge" },
      },
      {
        label: "Stylists",
        description: "Meet the team and specialties.",
        prompt: "Who specializes in blonding?",
        route: { type: "knowledge" },
      },
      {
        label: "Gift cards",
        description: "Purchase or redeem credits.",
        prompt: "How do I buy a gift card?",
        route: { type: "link", url: "https://studiolumen.com/gift" },
      },
      {
        label: "Talk to a person",
        description: "Chat with the desk",
        prompt: "Connect me to the desk",
        route: { type: "handoff" },
      },
    ]),
    faqs: buildFaqs([
      {
        question: "Do you take walk-ins?",
        answer: "We can often fit in walk-ins before 3pm. Tap 'Book an appointment' to see today's availability.",
        category: "Bookings",
      },
      {
        question: "Which stylists take new clients?",
        answer: "Mara, Isaac, and Priya currently accept new guests with 1 week's notice.",
        category: "Stylists",
      },
      {
        question: "Do you offer memberships?",
        answer: "Yes—memberships start at $120/month and include priority booking plus product credits.",
        category: "Memberships",
      },
    ]),
    policies: buildPolicies([
      {
        title: "Cancellation",
        description: "We just need 6 hours notice to release your appointment.",
        category: "Policies",
      },
      {
        title: "Late arrivals",
        description: "Arrive within 10 minutes of your booking to guarantee your slot.",
        category: "Policies",
      },
    ]),
    integrations: buildIntegrations([
      {
        name: "Square Appointments",
        category: "Scheduling",
        status: "connected",
        description: "Sync services, stylists, and availability blocks.",
        credentialLabel: "Location token",
        lastSynced: timestamp,
      },
      {
        name: "Mindbody",
        category: "Memberships",
        status: "not_connected",
        description: "Push membership status into Tandem replies.",
        credentialLabel: "Site ID",
      },
    ]),
    theme: {
      primaryColor: "#EC4899",
      accentColor: "#C084FC",
      surfaceColor: "#0B0C14",
      textPrimaryColor: "#F9FAFB",
      textSecondaryColor: "#E5E7EB",
      fontFamily: "'Geist', sans-serif",
      logoUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&crop=faces&auto=format",
    },
    handoff: createHandoff({
      headline: "Studio desk",
      status: "online",
      statusDetail: "Replies within 10 minutes",
      supportHoursLabel: "Live daily · 9a-8p ET",
      contactMethods: handoffContacts,
      offlineMessage: "We'll follow up first thing next business day.",
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
 }

 function createRetailTemplate(): BusinessProfile {
  const name = "Field Supply";
  const timezone = "America/Denver";
  const timestamp = new Date().toISOString();
  const contacts = buildContacts([
    {
      type: "email",
      label: "Support",
      value: "support@fieldsupply.com",
      enabled: true,
    },
    {
      type: "phone",
      label: "Store",
      value: "+1 (303) 555-0158",
      enabled: true,
    },
  ]);
  const handoffContacts = buildContacts([
    {
      type: "email",
      label: "Email support",
      value: "help@fieldsupply.com",
      enabled: true,
    },
    {
      type: "phone",
      label: "Call store",
      value: "+1 (303) 555-0158",
      enabled: true,
    },
  ]);

  return {
    id: createId(),
    slug: slugify(name),
    name,
    businessName: name,
    businessSlug: slugify(name),
    locationName: "Blake St",
    locationSlug: "blake-st",
    industry: "retail",
    timezone,
    tagline: "Concierge for modern retail",
    summary: "Field Supply blends curated retail with a concierge that tracks orders, restocks, and appointments.",
    location: "1210 Blake St, Denver",
    contacts,
    hours: buildHours([
      {
        label: "Store",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        open: "10:00",
        close: "19:00",
      },
      {
        label: "Sunday",
        days: ["Sun"],
        open: "11:00",
        close: "17:00",
      },
    ]),
    intents: buildIntents([
      {
        label: "Track an order",
        description: "Find order status and delivery ETA.",
        prompt: "I want to track an order.",
        route: { type: "handoff" },
      },
      {
        label: "Product availability",
        description: "Check if an item is in stock.",
        prompt: "Do you have the Ridge travel bag in stock?",
        route: { type: "knowledge" },
      },
      {
        label: "Book a fitting",
        description: "Schedule in-store styling.",
        prompt: "I'd like to book a fitting appointment.",
        route: { type: "link", url: "https://fieldsupply.com/book" },
      },
      {
        label: "Gift services",
        description: "Gift wrap and delivery.",
        prompt: "Do you offer gift wrapping?",
        route: { type: "knowledge" },
      },
      {
        label: "Talk to support",
        description: "Chat with a person.",
        prompt: "Connect me to support.",
        route: { type: "handoff" },
      },
    ]),
    faqs: buildFaqs([
      {
        question: "How long do deliveries take?",
        answer: "Domestic orders ship within 2 business days and arrive 2-4 days later.",
        category: "Shipping",
      },
      {
        question: "Do you offer returns?",
        answer: "Returns are free within 30 days with tags attached.",
        category: "Returns",
      },
      {
        question: "Can I pick up in store?",
        answer: "Yes—choose same-day pickup during checkout and we'll text when it's ready.",
        category: "Pickup",
      },
    ]),
    policies: buildPolicies([
      {
        title: "Price adjustments",
        description: "We'll honor price adjustments within 10 days of purchase.",
        category: "Policies",
      },
      {
        title: "Warranty",
        description: "All technical gear includes a 1-year workmanship warranty.",
        category: "Policies",
      },
    ]),
    integrations: buildIntegrations([
      {
        name: "Shopify",
        category: "Commerce",
        status: "connected",
        description: "Sync catalog details and order lookups.",
        credentialLabel: "Storefront token",
        lastSynced: timestamp,
      },
      {
        name: "Klaviyo",
        category: "CRM",
        status: "not_connected",
        description: "Trigger follow-up campaigns from chat transcripts.",
        credentialLabel: "Public key",
      },
      {
        name: "Postmates",
        category: "Delivery",
        status: "not_connected",
        description: "Provide delivery status updates inside chat.",
        credentialLabel: "Store ID",
      },
    ]),
    theme: {
      primaryColor: "#2563EB",
      accentColor: "#22D3EE",
      surfaceColor: "#05060A",
      textPrimaryColor: "#F4F4F5",
      textSecondaryColor: "#94A3B8",
      fontFamily: "'Geist', sans-serif",
      logoUrl: "https://images.unsplash.com/photo-1503602642458-232111445657?w=200&h=200&crop=faces&auto=format",
    },
    handoff: createHandoff({
      headline: "Support desk",
      status: "online",
      statusDetail: "Typically replies under 5 minutes",
      supportHoursLabel: "Live daily · 9a-7p MT",
      contactMethods: handoffContacts,
      offlineMessage: "Leave your order number and we'll follow up.",
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
 }

 function buildContacts(defs: Array<Omit<ContactMethod, "id">>): ContactMethod[] {
  return defs.map((def) => ({ ...def, id: createId() }));
 }

 function buildHours(defs: Array<Omit<OperatingHoursBlock, "id">>): OperatingHoursBlock[] {
  return defs.map((def) => ({ ...def, id: createId() }));
 }

 function buildIntents(defs: Array<Omit<Intent, "id" | "lastUpdated">>): Intent[] {
  const timestamp = new Date().toISOString();
  return defs.map((def) => ({ ...def, id: createId(), lastUpdated: timestamp }));
 }

function buildFaqs(
  defs: Array<Omit<FAQItem, "id" | "updatedAt" | "showInHelp"> & { showInHelp?: boolean }>,
): FAQItem[] {
  const timestamp = new Date().toISOString();
  return defs.map((def) => ({
    ...def,
    id: createId(),
    updatedAt: timestamp,
    showInHelp: def.showInHelp ?? true,
  }));
 }

function buildPolicies(
  defs: Array<Omit<PolicyItem, "id" | "updatedAt" | "showInHelp"> & { showInHelp?: boolean }>,
): PolicyItem[] {
  const timestamp = new Date().toISOString();
  return defs.map((def) => ({
    ...def,
    id: createId(),
    updatedAt: timestamp,
    showInHelp: def.showInHelp ?? true,
  }));
 }

function buildIntegrations(defs: Array<Omit<IntegrationConfig, "id">>): IntegrationConfig[] {
  return defs.map((def) => ({ ...def, id: createId() }));
}

 function createHandoff(config: Omit<HandoffConfig, "contactMethods"> & { contactMethods: ContactMethod[] }): HandoffConfig {
  return {
    ...config,
    contactMethods: config.contactMethods.map((contact) => ({ ...contact, id: createId() })),
  };
 }

 function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mock-${Math.random().toString(36).slice(2, 10)}`;
 }

 function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
 }
