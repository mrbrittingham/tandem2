"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem, WidgetThemeSettings } from "@tandem/shared";
import type { WebsiteImportDraft, WebsiteImportRunRecord } from "@/lib/website-import/types";
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
  const [editingFaqIds, setEditingFaqIds] = useState<Record<string, boolean>>({});
  const [editingPolicyIds, setEditingPolicyIds] = useState<Record<string, boolean>>({});

  const selectedLocation = useMemo(
    () => locationOptions.find((entry) => entry.slug === selectedLocationSlug),
    [locationOptions, selectedLocationSlug],
  );

  const locationGuardError = useMemo(() => {
    if (!businessSlug) {
      return "Business details are missing. Select a valid location before importing.";
    }
    if (!locationOptions.length) {
      return isLoadingLocations ? null : "No locations found for this business.";
    }
    if (!selectedLocation) {
      return "Choose a valid location before importing.";
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
          setError("Could not load locations for website import.");
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
        setDraft(payload.run?.result ?? null);

        if (payload.run?.id && (payload.run.status === "queued" || payload.run.status === "running")) {
          setActiveRunId(payload.run.id);
          setIsLoading(true);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load the latest import.");
        }
      }
    };

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, locationGuardError, selectedLocationSlug]);

  const runImport = async (nextUrl?: string) => {
    const targetUrl = (nextUrl ?? url).trim();

    if (!targetUrl) {
      setError("Website URL is required.");
      return;
    }

    if (locationGuardError || !selectedLocationSlug) {
      setError(locationGuardError ?? "Choose a valid location before importing.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);
    let queued = false;

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

      queued = true;
      setActiveRunId(payload.runId);
      setUrl(targetUrl);
      setSuccess("Import started. We will update this section when it is ready.");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Import failed";
      setError(message);
    } finally {
      if (!queued) {
        setIsLoading(false);
      }
    }
  };

  const refreshImport = async () => {
    await runImport(url);
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
        setDraft(runPayload.run.result ?? null);

        if (runPayload.run.status === "succeeded") {
          setSuccess("Suggestions are ready to review.");
          setIsLoading(false);
          setActiveRunId(null);
          return;
        }

        if (runPayload.run.status === "failed") {
          setError(getFriendlyImportError(runPayload.run.error ?? "Import failed", runPayload.run.errorCode ?? undefined));
          setIsLoading(false);
          setActiveRunId(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          const message = pollError instanceof Error ? pollError.message : "Failed to load import status";
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

        if (draft.businessProfile.phone.value) {
          const existingPhone = record.contacts.find((entry) => entry.type === "phone");
          if (existingPhone) {
            existingPhone.value = draft.businessProfile.phone.value;
            existingPhone.enabled = true;
          } else {
            record.contacts.unshift({
              id: crypto.randomUUID(),
              type: "phone",
              label: "Phone",
              value: draft.businessProfile.phone.value,
              enabled: true,
            });
          }
        }

        if (draft.businessProfile.email.value) {
          const existingEmail = record.contacts.find((entry) => entry.type === "email");
          if (existingEmail) {
            existingEmail.value = draft.businessProfile.email.value;
            existingEmail.enabled = true;
          } else {
            record.contacts.push({
              id: crypto.randomUUID(),
              type: "email",
              label: "Email",
              value: draft.businessProfile.email.value,
              enabled: true,
            });
          }
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
      });

      setSuccess("Imported details saved.");
      setRun((current) =>
        current
          ? {
              ...current,
              appliedAt: new Date().toISOString(),
            }
          : current,
      );
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Failed to save imported details";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const discardDraft = () => {
    setDraft(null);
    setSuccess(null);
    setError(null);
    setEditingFaqIds({});
    setEditingPolicyIds({});
  };

  const setFaqInclude = (id: string, include: boolean) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        faqs: current.faqs.map((faq) => (faq.id === id ? { ...faq, include } : faq)),
      };
    });
  };

  const setPolicyInclude = (id: string, include: boolean) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        policies: current.policies.map((policy) => (policy.id === id ? { ...policy, include } : policy)),
      };
    });
  };

  const hasSuggestions = Boolean((draft?.faqs.length ?? 0) > 0 || (draft?.policies.length ?? 0) > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Import from your website</h3>
          <p className="mt-1 text-sm text-slate-600">Crawl key pages like menus, reservations, and events. Review everything before applying.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Location</span>
            <select
              value={selectedLocationSlug}
              onChange={(event) => setSelectedLocationSlug(event.target.value)}
              disabled={isLoadingLocations || locationOptions.length === 0}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-[var(--console-primary)] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {locationOptions.length === 0 ? <option value="">No locations available</option> : null}
              {locationOptions.map((location) => (
                <option key={location.id} value={location.slug}>
                  {location.name} ({location.slug})
                </option>
              ))}
            </select>
          </label>
          <a
            href="/locations"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Choose location
          </a>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <TextInput
            label="Website URL"
            value={url}
            onChange={setUrl}
            placeholder="https://example.com"
          />
          <button
            type="button"
            onClick={() => runImport()}
            disabled={isLoading || Boolean(locationGuardError)}
            className="rounded-2xl bg-[var(--console-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Importing..." : "Import Details"}
          </button>
          <button
            type="button"
            onClick={refreshImport}
            disabled={isLoading || !url.trim() || Boolean(locationGuardError)}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh Data
          </button>
        </div>

        {run ? <p className="mt-3 text-xs text-slate-500">Last import: {formatDate(run.finishedAt ?? run.createdAt)} ({run.status})</p> : null}
        {locationGuardError ? <p className="mt-3 text-sm text-amber-700">{locationGuardError}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Suggestions from your website</h3>
        <p className="mt-1 text-sm text-slate-600">We found a few things on your website that may help answer customer questions.</p>

        {!draft ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Import your website to review suggested questions and policies.
          </p>
        ) : !hasSuggestions ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            We did not find suggestions this time. Try another page or refresh your import.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {draft.faqs.map((faq) => {
              const isEditing = Boolean(editingFaqIds[faq.id]);
              return (
                <article key={faq.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Suggested Question</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${faq.include ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {faq.include ? "Accepted" : "Dismissed"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <TextInput
                        label="Question"
                        value={faq.question}
                        onChange={(value) => {
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  faqs: current.faqs.map((entry) => (entry.id === faq.id ? { ...entry, question: value } : entry)),
                                }
                              : current,
                          );
                        }}
                      />
                      <TextInput
                        label="Suggested answer"
                        multiline
                        rows={3}
                        value={faq.answer}
                        onChange={(value) => {
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  faqs: current.faqs.map((entry) => (entry.id === faq.id ? { ...entry, answer: value } : entry)),
                                }
                              : current,
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900">{faq.question || "Untitled question"}</h4>
                      <p className="text-sm text-slate-600">{faq.answer || "No suggested answer yet."}</p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFaqInclude(faq.id, true)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFaqIds((current) => ({ ...current, [faq.id]: !current[faq.id] }))}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      {isEditing ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFaqInclude(faq.id, false)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              );
            })}

            {draft.policies.map((policy) => {
              const isEditing = Boolean(editingPolicyIds[policy.id]);
              return (
                <article key={policy.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Suggested Policy</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${policy.include ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {policy.include ? "Accepted" : "Dismissed"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <TextInput
                        label="Title"
                        value={policy.title}
                        onChange={(value) => {
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  policies: current.policies.map((entry) => (entry.id === policy.id ? { ...entry, title: value } : entry)),
                                }
                              : current,
                          );
                        }}
                      />
                      <TextInput
                        label="Suggested details"
                        multiline
                        rows={3}
                        value={policy.summary}
                        onChange={(value) => {
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  policies: current.policies.map((entry) => (entry.id === policy.id ? { ...entry, summary: value } : entry)),
                                }
                              : current,
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900">{policy.title || "Untitled policy"}</h4>
                      <p className="text-sm text-slate-600">{policy.summary || "No suggested details yet."}</p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPolicyInclude(policy.id, true)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPolicyIds((current) => ({ ...current, [policy.id]: !current[policy.id] }))}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      {isEditing ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyInclude(policy.id, false)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Brand Style</h3>
        <p className="mt-1 text-sm text-slate-600">These settings help your assistant match your brand when responding.</p>

        {!draft ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Import your website to prefill brand style settings.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput
              label="Primary color"
              value={draft.brand.primaryColor.value ?? ""}
              onChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        brand: {
                          ...current.brand,
                          primaryColor: { ...current.brand.primaryColor, value },
                        },
                      }
                    : current,
                )
              }
              placeholder="#3170FC"
            />
            <TextInput
              label="Accent color"
              value={draft.brand.accentColor.value ?? ""}
              onChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        brand: {
                          ...current.brand,
                          accentColor: { ...current.brand.accentColor, value },
                        },
                      }
                    : current,
                )
              }
              placeholder="#9E4770"
            />
            <TextInput
              label="Font family"
              value={draft.brand.fontFamily.value ?? ""}
              onChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        brand: {
                          ...current.brand,
                          fontFamily: { ...current.brand.fontFamily, value },
                        },
                      }
                    : current,
                )
              }
              placeholder="Inter, sans-serif"
            />
            <TextInput
              label="Logo URL"
              value={draft.brand.logoUrl.value ?? ""}
              onChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        brand: {
                          ...current.brand,
                          logoUrl: { ...current.brand.logoUrl, value },
                        },
                      }
                    : current,
                )
              }
              placeholder="https://example.com/logo.svg"
            />
          </div>
        )}

        {draft ? (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={applyImport}
              disabled={isApplying}
              className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? "Saving..." : "Save imported details"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
