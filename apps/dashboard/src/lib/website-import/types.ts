export type ImportRunStatus = "queued" | "running" | "succeeded" | "failed";

export type WebsitePageType =
  | "home"
  | "menu"
  | "events"
  | "reservations"
  | "memberships"
  | "private-events"
  | "catering"
  | "contact"
  | "hours"
  | "faq"
  | "policies"
  | "about"
  | "general";

export type CrawledPage = {
  url: string;
  title: string;
  textExcerpt: string;
  structuredText?: string;
  pageType?: WebsitePageType;
  metaDescription?: string;
  headingText?: string[];
  sourceAnchorTexts?: string[];
};

export type SocialLink = {
  platform: "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "other";
  url: string;
  sourceUrl: string;
};

export type ImportSignals = {
  emails: Array<{ value: string; sourceUrl: string }>;
  phones: Array<{ value: string; sourceUrl: string }>;
  addresses: Array<{ value: string; sourceUrl: string }>;
  hours: Array<{ value: string; sourceUrl: string }>;
  bookingLinks: Array<{ url: string; label: string; sourceUrl: string; platform: string | null }>;
  socialLinks: SocialLink[];
  logoCandidates: Array<{ url: string; sourceUrl: string }>;
  faviconCandidates: Array<{ url: string; sourceUrl: string }>;
  colorCandidates: Array<{ value: string; sourceUrl: string }>;
  fontCandidates: Array<{ value: string; sourceUrl: string }>;
};

export type ImportClaim<T> = {
  value: T | null;
  sourceUrl: string | null;
  confidence?: number;
};

export type ImportFaq = {
  id: string;
  question: string;
  answer: string;
  sourceUrl: string | null;
  include: boolean;
  confidence?: number;
  lowConfidence?: boolean;
};

export type ImportPolicy = {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string | null;
  include: boolean;
};

export type ImportEvent = {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  description: string;
  category: string;
  bookingInfo: string | null;
  bookingUrl: string | null;
  pricing: string | null;
  location: string | null;
  sourceUrl: string | null;
  recurring: boolean;
  include: boolean;
};

export type ImportMenuItem = {
  id: string;
  name: string;
  price: string | null;
  description: string;
  dietaryNotes: string | null;
  include: boolean;
};

export type ImportMenuSection = {
  id: string;
  title: string;
  sourceUrl: string | null;
  include: boolean;
  items: ImportMenuItem[];
};

export type ImportReservationInfo = {
  include: boolean;
  sourceUrl: string | null;
  bookingUrl: string | null;
  platforms: string[];
  instructions: string;
  partySizeNotes: string | null;
  depositPolicy: string | null;
  experienceNotes: string | null;
};

export type ImportMembershipInfo = {
  include: boolean;
  sourceUrl: string | null;
  name: string;
  benefits: string;
  pickupDetails: string | null;
  signupUrl: string | null;
  memberEventNotes: string | null;
};

export type WebsiteImportDraft = {
  sourceUrl: string;
  pageClassification: Array<{ url: string; title: string; pageType: WebsitePageType }>;
  businessProfile: {
    name: ImportClaim<string>;
    shortDescription: ImportClaim<string>;
    phone: ImportClaim<string>;
    email: ImportClaim<string>;
    address: ImportClaim<string>;
    hours: ImportClaim<string>;
    socialLinks: SocialLink[];
  };
  faqs: ImportFaq[];
  policies: ImportPolicy[];
  restaurantKnowledge: {
    events: ImportEvent[];
    menuSections: ImportMenuSection[];
    reservations: ImportReservationInfo;
    memberships: ImportMembershipInfo;
  };
  brand: {
    primaryColor: ImportClaim<string>;
    accentColor: ImportClaim<string>;
    backgroundColor: ImportClaim<string>;
    textColor: ImportClaim<string>;
    fontFamily: ImportClaim<string>;
    logoUrl: ImportClaim<string>;
  };
  restaurantInsights?: {
    eventHighlights?: string | null;
    reservationGuidance?: string | null;
    membershipNotes?: string | null;
    menuSummary?: string | null;
  };
  evidence: {
    pages: Array<{ url: string; title: string }>;
  };
};

export type WebsiteImportResult = {
  pages: CrawledPage[];
  signals: ImportSignals;
  draft: WebsiteImportDraft;
};

export type WebsiteImportRunRecord = {
  id: string;
  locationId: string;
  url: string;
  status: ImportRunStatus;
  error: string | null;
  errorCode?: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  appliedAt: string | null;
  pages: CrawledPage[];
  signals: ImportSignals;
  result: WebsiteImportDraft | null;
};
