"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem, WidgetThemeSettings } from "@tandem/shared";
import type { WebsiteImportDraft, WebsiteImportRunRecord } from "@/lib/website-import/types";
import { SCHEMA_OUT_OF_DATE_CODE } from "@/lib/website-import/api-errors";
import { normalizeWidgetTheme } from "@/lib/widget-theme";
import { pickReadableTextColor } from "@/lib/website-import/utils";
import { SectionCard } from "./SectionCard";
import { TextInput } from "./TextInput";
import { updateBusiness } from "@/lib/store-hooks";

type LatestImportResponse = {
  location?: {
    id: string;
    websiteUrl?: string | null;
    lastImportRunId?: string | null;
  };
  run?: WebsiteImportRunRecord | null;
  code?: string;
  error?: string;
};

type StartImportResponse = {
  ok?: boolean;
  runId?: string;
  status?: string;
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
  summary?: {
    theme?: WidgetThemeSettings;
    faqCount?: number;
    policyCount?: number;
  };
  error?: string;
};

type LocationOption = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  address?: string | null;
  createdAt?: string;
};

type LocationsResponse = {
  locations?: LocationOption[];
  error?: string;
};

function getFriendlyImportError(error?: string, code?: string) {
  if (code === SCHEMA_OUT_OF_DATE_CODE) {
    return "Database schema not up to date. Run `npm run db:push`.";
  }

  const message = (error ?? "").toLowerCase();
  if (
    message.includes("schema cache")
    || (message.includes("onboarding_import_runs") && message.includes("does not exist"))
    || (message.includes("business_locations") && message.includes("website_url") && message.includes("does not exist"))
  ) {
    return "Database schema not up to date. Run `npm run db:push`.";
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
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WebsiteImportPanel({ business }: { business: BusinessProfile }) {
  const businessSlug = (business.businessSlug ?? business.slug ?? "").trim();
  const initialLocationSlug = (business.locationSlug ?? business.slug ?? "").trim();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationSlug, setSelectedLocationSlug] = useState("");
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [url, setUrl] = useState("");
  const [lastImportedUrl, setLastImportedUrl] = useState<string | null>(null);
  const [run, setRun] = useState<WebsiteImportRunRecord | null>(null);
  const [draft, setDraft] = useState<WebsiteImportDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const reviewDraft = draft;
  const selectedLocation = useMemo(
    () => locationOptions.find((entry) => entry.slug === selectedLocationSlug),
    [locationOptions, selectedLocationSlug],
  );

  const locationGuardError = useMemo(() => {
    if (!businessSlug) {
      return "Business slug missing. Select a valid business before importing.";
    }
    if (!locationOptions.length) {
      return isLoadingLocations ? null : "No locations found for this business. Pick a location to continue.";
    }
    if (!selectedLocation) {
      return "Selected location is invalid for this business. Pick a location to continue.";
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
          setError("Failed to load locations for website import");
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

      setLastImportedUrl(null);

      try {
        const params = new URLSearchParams();
        if (businessSlug) {
          params.set("businessSlug", businessSlug);
        }
        params.set("locationSlug", selectedLocationSlug);

        const response = await fetch(
          `/api/website-import/latest?${params.toString()}`,
          { method: "GET" },
        );

        const payload = (await response.json().catch(() => ({}))) as LatestImportResponse;
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(getFriendlyImportError(payload.error, payload.code));
          return;
        }

        setLocationId(payload.location?.id ?? null);
        const latestUrl = (payload.location?.websiteUrl ?? payload.run?.url ?? "").trim();
        setLastImportedUrl(latestUrl || null);
        setRun(payload.run ?? null);
        setDraft(payload.run?.result ?? null);
        setHasPendingSave(false);
        setLastSavedAt(payload.run?.appliedAt ?? null);
        if (payload.run?.id && (payload.run.status === "queued" || payload.run.status === "running")) {
          setActiveRunId(payload.run.id);
          setIsLoading(true);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load import metadata");
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
      setError("Website URL is required");
      return;
    }

    if (locationGuardError || !selectedLocationSlug) {
      setError(locationGuardError ?? "Pick a valid location before running import");
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
      setSuccess("Import queued. We will update this panel when processing completes.");
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
        setLocationId(runPayload.run.locationId);

        if (runPayload.run.status === "succeeded") {
          setSuccess("Import draft ready for review");
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
          const message = pollError instanceof Error ? pollError.message : "Failed to load run status";
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

  useEffect(() => {
    if (!hasPendingSave || typeof window === "undefined") {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasPendingSave]);

  const stageImport = () => {
    if (!draft) {
      return;
    }

    setError(null);
    setSuccess(null);

    updateBusiness(business.id, (record) => {
      if (draft.businessProfile.name.value) {
        record.businessName = draft.businessProfile.name.value;
        record.name = draft.businessProfile.name.value;
      }
      if (draft.businessProfile.shortDescription.value) {
        record.summary = draft.businessProfile.shortDescription.value;
      }
      if (draft.businessProfile.address.value) {
        record.location = draft.businessProfile.address.value;
      }

      const theme = mergeThemeFromDraft(record.theme, draft);
      record.theme = theme;

      const importedFaqs = toFaqItems(draft);
      if (importedFaqs.length > 0) {
        record.faqs = importedFaqs;
      }

      const importedPolicies = toPolicyItems(draft);
      if (importedPolicies.length > 0) {
        record.policies = importedPolicies;
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

    setHasPendingSave(true);
    setSuccess("Import changes staged. Click Save changes to persist.");
  };

  const saveImport = async () => {
    if (!run?.id || !draft || !hasPendingSave) {
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

      setHasPendingSave(false);
      const nowIso = new Date().toISOString();
      setLastSavedAt(nowIso);
      setSuccess(`Saved ${new Date(nowIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      setRun((current) =>
        current
          ? {
              ...current,
              appliedAt: nowIso,
            }
          : current,
      );
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Failed to apply import";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const discardDraft = () => {
    if (hasPendingSave && typeof window !== "undefined") {
      const confirmed = window.confirm("Discard staged import changes? Unsaved changes will be lost.");
      if (!confirmed) {
        return;
      }
    }

    setDraft(null);
    setSuccess(null);
    setError(null);
    setHasPendingSave(false);
  };

  const profileRows = useMemo(() => {
    if (!draft) {
      return [];
    }

    return [
      { key: "name", label: "Business name", value: draft.businessProfile.name.value ?? "", sourceUrl: draft.businessProfile.name.sourceUrl },
      {
        key: "shortDescription",
        label: "Short description",
        value: draft.businessProfile.shortDescription.value ?? "",
        sourceUrl: draft.businessProfile.shortDescription.sourceUrl,
      },
      { key: "phone", label: "Phone", value: draft.businessProfile.phone.value ?? "", sourceUrl: draft.businessProfile.phone.sourceUrl },
      { key: "email", label: "Email", value: draft.businessProfile.email.value ?? "", sourceUrl: draft.businessProfile.email.sourceUrl },
      { key: "address", label: "Address", value: draft.businessProfile.address.value ?? "", sourceUrl: draft.businessProfile.address.sourceUrl },
      { key: "hours", label: "Hours", value: draft.businessProfile.hours.value ?? "", sourceUrl: draft.businessProfile.hours.sourceUrl },
    ] as const;
  }, [draft]);

  return (
    <SectionCard
      title="Import from Website"
      description="Run a one-time website import, review suggested knowledge and branding, then apply when ready."
      actions={
        run ? (
          <span className="text-xs text-slate-500">Last import {formatDate(run.finishedAt ?? run.createdAt)} ({run.status})</span>
        ) : null
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,26rem)_auto] md:items-end">
          <label className="block w-full text-sm">
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
            Pick a location
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,36rem)_auto_auto] md:items-end">
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
            {isLoading ? "Running…" : "Run import"}
          </button>
          <button
            type="button"
            onClick={refreshImport}
            disabled={isLoading || !url.trim() || Boolean(locationGuardError)}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh import
          </button>
        </div>

        {lastImportedUrl && !url.trim() ? (
          <div>
            <button
              type="button"
              onClick={() => setUrl(lastImportedUrl)}
              className="text-xs font-medium text-slate-600 underline hover:text-slate-800"
            >
              Resume last URL ({lastImportedUrl})
            </button>
          </div>
        ) : null}

        {locationGuardError ? (
          <p className="text-sm text-amber-700">{locationGuardError}</p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {locationId ? <p>Location ID: {locationId}</p> : null}
          {lastSavedAt ? <p>Last saved {formatDate(lastSavedAt)}</p> : null}
          {hasPendingSave ? <p className="font-medium text-amber-700">Unsaved staged changes</p> : null}
        </div>

        {!reviewDraft ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Run an import to generate editable business profile, FAQs, policies, and brand suggestions.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Business profile</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {profileRows.map((row) => (
                  <div key={row.key} className="space-y-2">
                    <TextInput
                      label={row.label}
                      value={row.value}
                      onChange={(value) => {
                        setDraft((current) => {
                          if (!current) {
                            return current;
                          }
                          if (row.key === "name") current.businessProfile.name.value = value;
                          if (row.key === "shortDescription") current.businessProfile.shortDescription.value = value;
                          if (row.key === "phone") current.businessProfile.phone.value = value;
                          if (row.key === "email") current.businessProfile.email.value = value;
                          if (row.key === "address") current.businessProfile.address.value = value;
                          if (row.key === "hours") current.businessProfile.hours.value = value;
                          return { ...current };
                        });
                      }}
                    />
                    {row.sourceUrl ? (
                      <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-500 underline">
                        Evidence
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Suggested FAQs</h3>
              <div className="mt-3 space-y-3">
                {reviewDraft.faqs.length === 0 ? (
                  <p className="text-sm text-slate-500">No FAQs detected in this crawl.</p>
                ) : (
                  reviewDraft.faqs.map((faq, index) => (
                    <article key={faq.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={faq.include}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setDraft((current) => {
                                if (!current) return current;
                                const next = [...current.faqs];
                                next[index] = { ...next[index], include: checked };
                                return { ...current, faqs: next };
                              });
                            }}
                          />
                          Include
                        </label>
                        {faq.sourceUrl ? (
                          <a href={faq.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline">
                            Source
                          </a>
                        ) : null}
                        {faq.lowConfidence ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Low confidence</span>
                        ) : null}
                      </div>
                      <TextInput
                        label="Question"
                        value={faq.question}
                        onChange={(value) => {
                          setDraft((current) => {
                            if (!current) return current;
                            const next = [...current.faqs];
                            next[index] = { ...next[index], question: value };
                            return { ...current, faqs: next };
                          });
                        }}
                      />
                      <div className="mt-3">
                        <TextInput
                          label="Answer"
                          multiline
                          rows={3}
                          value={faq.answer}
                          onChange={(value) => {
                            setDraft((current) => {
                              if (!current) return current;
                              const next = [...current.faqs];
                              next[index] = { ...next[index], answer: value };
                              return { ...current, faqs: next };
                            });
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Suggested policies</h3>
              <div className="mt-3 space-y-3">
                {reviewDraft.policies.length === 0 ? (
                  <p className="text-sm text-slate-500">No policies detected in this crawl.</p>
                ) : (
                  reviewDraft.policies.map((policy, index) => (
                    <article key={policy.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={policy.include}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setDraft((current) => {
                                if (!current) return current;
                                const next = [...current.policies];
                                next[index] = { ...next[index], include: checked };
                                return { ...current, policies: next };
                              });
                            }}
                          />
                          Include
                        </label>
                        {policy.sourceUrl ? (
                          <a href={policy.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline">
                            Source
                          </a>
                        ) : null}
                      </div>
                      <TextInput
                        label="Title"
                        value={policy.title}
                        onChange={(value) => {
                          setDraft((current) => {
                            if (!current) return current;
                            const next = [...current.policies];
                            next[index] = { ...next[index], title: value };
                            return { ...current, policies: next };
                          });
                        }}
                      />
                      <div className="mt-3">
                        <TextInput
                          label="Summary"
                          multiline
                          rows={3}
                          value={policy.summary}
                          onChange={(value) => {
                            setDraft((current) => {
                              if (!current) return current;
                              const next = [...current.policies];
                              next[index] = { ...next[index], summary: value };
                              return { ...current, policies: next };
                            });
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Brand suggestions</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Primary color"
                  value={reviewDraft.brand.primaryColor.value ?? ""}
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
                  value={reviewDraft.brand.accentColor.value ?? ""}
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
                  value={reviewDraft.brand.fontFamily.value ?? ""}
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
                  value={reviewDraft.brand.logoUrl.value ?? ""}
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
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={stageImport}
                className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Apply import to draft
              </button>
              <button
                type="button"
                onClick={saveImport}
                disabled={isApplying || !hasPendingSave}
                className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
