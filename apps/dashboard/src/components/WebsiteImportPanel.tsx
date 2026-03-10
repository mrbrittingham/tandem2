"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem, WidgetThemeSettings } from "@tandem/shared";
import type {
  ImportEvent,
  ImportMembershipInfo,
  ImportMenuSection,
  ImportReservationInfo,
  WebsiteImportDraft,
  WebsiteImportRunRecord,
  WebsitePageType,
} from "@/lib/website-import/types";
import { SCHEMA_OUT_OF_DATE_CODE } from "@/lib/website-import/api-errors";
import { normalizeWidgetTheme } from "@/lib/widget-theme";
import { pickReadableTextColor } from "@/lib/website-import/utils";
import { TextInput } from "./TextInput";
import { updateBusiness } from "@/lib/store-hooks";

type LatestImportResponse = {
  location?: {
    id: string;
    websiteUrl?: string | null;
  };
  run?: WebsiteImportRunRecord | null;
  code?: string;
  error?: string;
};

type StartImportResponse = {
  runId?: string;
  code?: string;
  error?: string;
};

type RunResponse = {
  run?: WebsiteImportRunRecord;
  code?: string;
  error?: string;
};

type ApplyResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
};

type LocationOption = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
};

type LocationsResponse = {
  locations?: LocationOption[];
  error?: string;
};

export type ImportedKnowledgePayload = {
  name?: string;
  shortDescription?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  faqs: FAQItem[];
  policies: PolicyItem[];
  insights?: {
    eventHighlights?: string;
    reservationGuidance?: string;
    membershipNotes?: string;
    menuSummary?: string;
  };
  structured?: {
    events: ImportEvent[];
    menuSections: ImportMenuSection[];
    reservations: ImportReservationInfo;
    memberships: ImportMembershipInfo;
    pageClassification: Array<{ url: string; title: string; pageType: WebsitePageType }>;
  };
};

function getFriendlyImportError(error?: string, code?: string) {
  if (code === SCHEMA_OUT_OF_DATE_CODE) {
    return "Database schema is out of date. Run npm run db:push.";
  }

  const message = (error ?? "").toLowerCase();
  if (
    message.includes("schema cache")
    || (message.includes("onboarding_import_runs") && message.includes("does not exist"))
    || (message.includes("business_locations") && message.includes("website_url") && message.includes("does not exist"))
  ) {
    return "Database schema is out of date. Run npm run db:push.";
  }

  return error ?? "Something went wrong. Please try again.";
}

function toFaqItems(draft: WebsiteImportDraft): FAQItem[] {
  const nowIso = new Date().toISOString();
  return draft.faqs
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: "Imported",
      showInHelp: true,
      updatedAt: nowIso,
    }));
}

function toPolicyItems(draft: WebsiteImportDraft): PolicyItem[] {
  const nowIso = new Date().toISOString();
  return draft.policies
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.summary,
      category: "Imported",
      showInHelp: true,
      updatedAt: nowIso,
    }));
}

function mergeThemeFromDraft(existing: WidgetThemeSettings, draft: WebsiteImportDraft): WidgetThemeSettings {
  const primary = draft.brand.primaryColor.value ?? existing.primaryColor;
  const accent = draft.brand.accentColor.value ?? existing.accentColor ?? primary;
  const surface = draft.brand.backgroundColor.value ?? existing.surfaceColor;
  const textPrimary = draft.brand.textColor.value ?? existing.textPrimaryColor ?? pickReadableTextColor(surface);

  return normalizeWidgetTheme({
    ...existing,
    primaryColor: primary,
    accentColor: accent,
    surfaceColor: surface,
    textPrimaryColor: textPrimary,
    fontFamily: draft.brand.fontFamily.value ?? existing.fontFamily,
    logoUrl: draft.brand.logoUrl.value ?? existing.logoUrl,
    headerBackground: {
      mode: "solid",
      solidColor: primary,
    },
    quickActions: {
      color: accent,
      variant: existing.quickActions?.variant ?? "solid",
    },
    sendButton: {
      color: accent,
      textColor: pickReadableTextColor(accent),
    },
  });
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelPageType(pageType: WebsitePageType) {
  switch (pageType) {
    case "menu": return "Menu";
    case "events": return "Events";
    case "reservations": return "Reservations";
    case "memberships": return "Memberships";
    case "private-events": return "Private events";
    case "catering": return "Catering";
    case "contact": return "Contact";
    case "hours": return "Hours";
    case "faq": return "FAQ";
    case "policies": return "Policies";
    case "about": return "About";
    case "home": return "Home";
    default: return "General";
  }
}

function normalizeDraft(draft: WebsiteImportDraft | null): WebsiteImportDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    pageClassification: Array.isArray(draft.pageClassification) ? draft.pageClassification : [],
    restaurantKnowledge: {
      events: Array.isArray(draft.restaurantKnowledge?.events) ? draft.restaurantKnowledge.events : [],
      menuSections: Array.isArray(draft.restaurantKnowledge?.menuSections) ? draft.restaurantKnowledge.menuSections : [],
      reservations: draft.restaurantKnowledge?.reservations ?? {
        include: false,
        sourceUrl: null,
        bookingUrl: null,
        platforms: [],
        instructions: "",
        partySizeNotes: null,
        depositPolicy: null,
        experienceNotes: null,
      },
      memberships: draft.restaurantKnowledge?.memberships ?? {
        include: false,
        sourceUrl: null,
        name: "",
        benefits: "",
        pickupDetails: null,
        signupUrl: null,
        memberEventNotes: null,
      },
    },
  };
}

export function WebsiteImportPanel({
  business,
  onApplyImportedContent,
}: {
  business: BusinessProfile;
  onApplyImportedContent?: (payload: ImportedKnowledgePayload) => void;
}) {
  const businessSlug = (business.businessSlug ?? business.slug ?? "").trim();
  const initialLocationSlug = (business.locationSlug ?? business.slug ?? "").trim();

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationSlug, setSelectedLocationSlug] = useState("");
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [url, setUrl] = useState("");
  const [run, setRun] = useState<WebsiteImportRunRecord | null>(null);
  const [draft, setDraft] = useState<WebsiteImportDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const selectedLocation = useMemo(
    () => locationOptions.find((entry) => entry.slug === selectedLocationSlug),
    [locationOptions, selectedLocationSlug],
  );

  const locationGuardError = useMemo(() => {
    if (!businessSlug) {
      return "Business details are missing. Select a valid location before scanning.";
    }
    if (!locationOptions.length) {
      return isLoadingLocations ? null : "No locations found for this business.";
    }
    if (!selectedLocation) {
      return "Choose a valid location before scanning.";
    }
    return null;
  }, [businessSlug, isLoadingLocations, locationOptions.length, selectedLocation]);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      if (!businessSlug) {
        setLocationOptions([]);
        setSelectedLocationSlug("");
        return;
      }

      setIsLoadingLocations(true);

      try {
        const params = new URLSearchParams();
        params.set("businessSlug", businessSlug);

        const response = await fetch(`/api/locations?${params.toString()}`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as LocationsResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load locations");
        }

        const options = payload.locations ?? [];
        setLocationOptions(options);
        const preferred = options.find((entry) => entry.slug === initialLocationSlug) ?? options[0];
        setSelectedLocationSlug(preferred?.slug ?? "");
      } catch {
        if (!cancelled) {
          setLocationOptions([]);
          setSelectedLocationSlug("");
          setError("Could not load locations for website scan.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocations(false);
        }
      }
    };

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, initialLocationSlug]);

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      if (locationGuardError || !selectedLocationSlug) {
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("businessSlug", businessSlug);
        params.set("locationSlug", selectedLocationSlug);

        const response = await fetch(`/api/website-import/latest?${params.toString()}`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as LatestImportResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(getFriendlyImportError(payload.error, payload.code));
          return;
        }

        setUrl((payload.location?.websiteUrl ?? payload.run?.url ?? "").trim());
        setRun(payload.run ?? null);
        setDraft(normalizeDraft(payload.run?.result ?? null));

        if (payload.run?.id && (payload.run.status === "queued" || payload.run.status === "running")) {
          setActiveRunId(payload.run.id);
          setIsLoading(true);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load the latest scan.");
        }
      }
    };

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, locationGuardError, selectedLocationSlug]);

  const runImport = async () => {
    const targetUrl = url.trim();

    if (!targetUrl) {
      setError("Website URL is required.");
      return;
    }

    if (locationGuardError || !selectedLocationSlug) {
      setError(locationGuardError ?? "Choose a valid location before scanning.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/website-import/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          businessSlug,
          locationSlug: selectedLocationSlug,
          url: targetUrl,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as StartImportResponse;
      if (!response.ok || !payload.runId) {
        throw new Error(getFriendlyImportError(payload.error, payload.code));
      }

      setActiveRunId(payload.runId);
      setSuccess("Scan started. Tandem is classifying pages and extracting structured restaurant knowledge.");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Scan failed";
      setError(message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const runResponse = await fetch(`/api/website-import/${encodeURIComponent(activeRunId)}`, {
          method: "GET",
        });

        const runPayload = (await runResponse.json().catch(() => ({}))) as RunResponse;

        if (cancelled) {
          return;
        }

        if (!runResponse.ok || !runPayload.run) {
          throw new Error(getFriendlyImportError(runPayload.error, runPayload.code));
        }

        setRun(runPayload.run);
        setDraft(normalizeDraft(runPayload.run.result ?? null));

        if (runPayload.run.status === "succeeded") {
          setSuccess("Scan complete. Review detected knowledge and apply when ready.");
          setIsLoading(false);
          setActiveRunId(null);
          return;
        }

        if (runPayload.run.status === "failed") {
          setError(getFriendlyImportError(runPayload.run.error ?? "Scan failed", runPayload.run.errorCode ?? undefined));
          setIsLoading(false);
          setActiveRunId(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          const message = pollError instanceof Error ? pollError.message : "Failed to load scan status";
          setError(message);
          setIsLoading(false);
          setActiveRunId(null);
        }
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeRunId]);

  const setEventInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        events: current.restaurantKnowledge.events.map((entry) => entry.id === id ? { ...entry, include } : entry),
      },
    } : current);
  };

  const removeEvent = (id: string) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        events: current.restaurantKnowledge.events.filter((entry) => entry.id !== id),
      },
    } : current);
  };

  const setMenuInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        menuSections: current.restaurantKnowledge.menuSections.map((entry) => entry.id === id ? { ...entry, include } : entry),
      },
    } : current);
  };

  const removeMenu = (id: string) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        menuSections: current.restaurantKnowledge.menuSections.filter((entry) => entry.id !== id),
      },
    } : current);
  };

  const setPolicyInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      policies: current.policies.map((entry) => entry.id === id ? { ...entry, include } : entry),
    } : current);
  };

  const setFaqInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      faqs: current.faqs.map((entry) => entry.id === id ? { ...entry, include } : entry),
    } : current);
  };

  const applyImport = async () => {
    if (!run?.id || !draft) {
      return;
    }

    setIsApplying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/website-import/${encodeURIComponent(run.id)}/apply`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ draft }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApplyResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(getFriendlyImportError(payload.error, payload.code));
      }

      const importedFaqs = toFaqItems(draft);
      const importedPolicies = toPolicyItems(draft);
      const nextTheme = mergeThemeFromDraft(business.theme, draft);

      updateBusiness(business.id, (record) => {
        if (draft.businessProfile.name.value) {
          record.businessName = draft.businessProfile.name.value;
          record.name = draft.businessProfile.name.value;
        }
        if (draft.businessProfile.shortDescription.value) {
          record.summary = draft.businessProfile.shortDescription.value;
          record.tagline = draft.businessProfile.shortDescription.value;
        }
        if (draft.businessProfile.address.value) {
          record.location = draft.businessProfile.address.value;
        }

        record.theme = nextTheme;

        if (importedFaqs.length > 0) {
          record.faqs = importedFaqs;
        }

        if (importedPolicies.length > 0) {
          record.policies = importedPolicies;
        }

        if (draft.businessProfile.hours.value) {
          record.handoff.supportHoursLabel = draft.businessProfile.hours.value;
          record.handoff.statusDetail = draft.businessProfile.hours.value;
        }

        record.updatedAt = new Date().toISOString();
      });

      onApplyImportedContent?.({
        name: draft.businessProfile.name.value ?? undefined,
        shortDescription: draft.businessProfile.shortDescription.value ?? undefined,
        phone: draft.businessProfile.phone.value ?? undefined,
        email: draft.businessProfile.email.value ?? undefined,
        address: draft.businessProfile.address.value ?? undefined,
        hours: draft.businessProfile.hours.value ?? undefined,
        faqs: importedFaqs,
        policies: importedPolicies,
        insights: {
          eventHighlights: draft.restaurantInsights?.eventHighlights ?? undefined,
          reservationGuidance: draft.restaurantInsights?.reservationGuidance ?? undefined,
          membershipNotes: draft.restaurantInsights?.membershipNotes ?? undefined,
          menuSummary: draft.restaurantInsights?.menuSummary ?? undefined,
        },
        structured: {
          events: draft.restaurantKnowledge.events.filter((entry) => entry.include),
          menuSections: draft.restaurantKnowledge.menuSections.filter((entry) => entry.include),
          reservations: draft.restaurantKnowledge.reservations,
          memberships: draft.restaurantKnowledge.memberships,
          pageClassification: draft.pageClassification,
        },
      });

      setSuccess("Structured website knowledge applied.");
      setRun((current) => current ? { ...current, appliedAt: new Date().toISOString() } : current);
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Failed to save imported details";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const pageTypeCounts = useMemo(() => {
    const result = new Map<WebsitePageType, number>();
    for (const entry of draft?.pageClassification ?? []) {
      result.set(entry.pageType, (result.get(entry.pageType) ?? 0) + 1);
    }
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
  }, [draft?.pageClassification]);

  return (
    <div className="space-y-5">
      {/* Scan Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Scan Website</h3>
        <p className="mt-1 text-sm text-slate-600">Tandem classifies pages first, then extracts structured restaurant knowledge by page type.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Location</span>
            <select
              value={selectedLocationSlug}
              onChange={(event) => setSelectedLocationSlug(event.target.value)}
              disabled={isLoadingLocations || locationOptions.length === 0}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
            >
              {locationOptions.length === 0 ? <option value="">No locations available</option> : null}
              {locationOptions.map((location) => (
                <option key={location.id} value={location.slug}>{location.name} ({location.slug})</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={runImport} disabled={isLoading || Boolean(locationGuardError)} className="rounded-2xl bg-[var(--console-primary)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? "Scanning..." : "Scan website"}
          </button>
        </div>

        <div className="mt-3">
          <TextInput label="Website URL" value={url} onChange={setUrl} placeholder="https://example.com" />
        </div>

        {run ? <p className="mt-3 text-xs text-slate-500">Last scan: {formatDate(run.finishedAt ?? run.createdAt)} ({run.status})</p> : null}
        {run ? <p className="mt-1 text-xs text-slate-500">Pages scanned: {run.pages.length} • Signals: {run.signals.emails.length + run.signals.phones.length + run.signals.addresses.length + run.signals.hours.length + run.signals.bookingLinks.length}</p> : null}
        {locationGuardError ? <p className="mt-2 text-sm text-amber-700">{locationGuardError}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
      </div>

      {/* Page Type Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Page Types</h3>
        {!draft ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">Run a scan to see page classification.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {pageTypeCounts.map(([pageType, count]) => (
              <span key={pageType} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{labelPageType(pageType)}: {count}</span>
            ))}
          </div>
        )}
      </div>

      {/* Detected Events — collapsible cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Events</h3>
        <div className="mt-3 space-y-2">
          {(draft?.restaurantKnowledge.events ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No events detected.</p>
          ) : draft?.restaurantKnowledge.events.map((event) => (
            <CollapsibleEventCard
              key={event.id}
              event={event}
              onToggleInclude={() => setEventInclude(event.id, !event.include)}
              onDelete={() => removeEvent(event.id)}
            />
          ))}
        </div>
      </div>

      {/* Detected Menus — collapsible cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Menus</h3>
        <div className="mt-3 space-y-2">
          {(draft?.restaurantKnowledge.menuSections ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No menu sections detected.</p>
          ) : draft?.restaurantKnowledge.menuSections.map((section) => (
            <CollapsibleMenuCard
              key={section.id}
              section={section}
              onToggleInclude={() => setMenuInclude(section.id, !section.include)}
              onDelete={() => removeMenu(section.id)}
            />
          ))}
        </div>
      </div>

      {/* Detected Reservations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Reservations</h3>
        <p className="mt-2 text-sm text-slate-700">{draft?.restaurantKnowledge.reservations.instructions || "No reservation guidance detected."}</p>
        {draft?.restaurantKnowledge.reservations.bookingUrl ? (
          <p className="mt-1 text-xs text-slate-600">Booking URL: {draft.restaurantKnowledge.reservations.bookingUrl}</p>
        ) : null}
        {draft?.restaurantKnowledge.reservations.platforms?.length ? (
          <p className="mt-1 text-xs text-slate-600">Platforms: {draft.restaurantKnowledge.reservations.platforms.join(", ")}</p>
        ) : null}
      </div>

      {/* Detected Memberships */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Memberships</h3>
        <p className="mt-2 text-sm text-slate-700">{draft?.restaurantKnowledge.memberships.benefits || "No membership information detected."}</p>
      </div>

      {/* Detected Policies */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Policies</h3>
        <div className="mt-3 space-y-2">
          {(draft?.policies ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No policies detected.</p>
          ) : draft?.policies.map((policy) => (
            <article key={policy.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{policy.title}</p>
                  <p className="text-sm text-slate-700">{policy.summary}</p>
                </div>
                <button type="button" onClick={() => setPolicyInclude(policy.id, !policy.include)} className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${policy.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{policy.include ? "Included" : "Excluded"}</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* FAQ Suggestions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">FAQ Suggestions</h3>
        <p className="mt-1 text-sm text-slate-500">Generated from extracted knowledge. Toggle to include or exclude.</p>
        <div className="mt-3 space-y-2">
          {(draft?.faqs ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No FAQ suggestions detected.</p>
          ) : draft?.faqs.map((faq) => (
            <article key={faq.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{faq.question}</p>
                  <p className="mt-0.5 text-sm text-slate-700">{faq.answer}</p>
                  {faq.lowConfidence ? <p className="mt-1 text-xs text-amber-600">Low confidence extraction</p> : null}
                </div>
                <button type="button" onClick={() => setFaqInclude(faq.id, !faq.include)} className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${faq.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{faq.include ? "Included" : "Excluded"}</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Review & Apply */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Review & Apply</h3>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => setDraft(null)} className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300">Clear draft</button>
          <button type="button" onClick={applyImport} disabled={isApplying || !draft} className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isApplying ? "Applying..." : "Apply structured knowledge"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Event Card                                             */
/* ------------------------------------------------------------------ */

function CollapsibleEventCard({
  event,
  onToggleInclude,
  onDelete,
}: {
  event: ImportEvent;
  onToggleInclude: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`rounded-xl border bg-slate-50/70 p-3 ${event.include ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500">{event.date ?? "Date unknown"}{event.time ? ` • ${event.time}` : ""}{event.location ? ` • ${event.location}` : ""}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onToggleInclude} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${event.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{event.include ? "Included" : "Excluded"}</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50" title="Remove event">✕</button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm text-slate-700">
          {event.description ? <p>{event.description}</p> : null}
          {event.category ? <p className="text-xs text-slate-500">Category: {event.category}</p> : null}
          {event.pricing ? <p className="text-xs text-slate-500">Price: {event.pricing}</p> : null}
          {event.bookingInfo ? <p className="text-xs text-slate-500">Booking notes: {event.bookingInfo}</p> : null}
          {event.bookingUrl ? <p className="text-xs text-slate-500">Booking URL: <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{event.bookingUrl}</a></p> : null}
          {event.sourceUrl ? <p className="text-xs text-slate-500">Source: <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{event.sourceUrl}</a></p> : null}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Menu Card                                              */
/* ------------------------------------------------------------------ */

function CollapsibleMenuCard({
  section,
  onToggleInclude,
  onDelete,
}: {
  section: ImportMenuSection;
  onToggleInclude: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = section.items.length;
  const previewItems = section.items.slice(0, 3).map((i) => i.name).join(", ");

  return (
    <article className={`rounded-xl border bg-slate-50/70 p-3 ${section.include ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{section.title}</p>
            <p className="truncate text-xs text-slate-500">{itemCount} item{itemCount !== 1 ? "s" : ""}{previewItems ? ` — ${previewItems}` : ""}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onToggleInclude} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${section.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{section.include ? "Included" : "Excluded"}</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50" title="Remove menu">✕</button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="space-y-1">
            {section.items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.description ? <span className="ml-1 text-slate-500">— {item.description}</span> : null}
                </div>
                {item.price ? <span className="shrink-0 font-medium text-slate-600">{item.price}</span> : null}
              </div>
            ))}
          </div>
          {section.sourceUrl ? (
            <p className="mt-2 text-xs text-slate-500">Source: <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{section.sourceUrl}</a></p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
