'use client';

import { useEffect, useMemo, useState } from "react";
import type { BusinessProfile, WidgetThemeSettings } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { resolveChatScope } from "@/lib/chat-scope";
import { updateBusiness, useActiveBusiness, useActiveLocation, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";
import { normalizeWidgetTheme } from "@/lib/widget-theme";

type BaseColorField = {
  key: "surfaceColor" | "textPrimaryColor" | "textSecondaryColor";
  label: string;
  hint: string;
};

// Used for the three simple color fields that map 1:1 to theme keys
const textAndSurfaceFields: BaseColorField[] = [
  { key: "surfaceColor", label: "Chat background", hint: "Background of the chat window" },
  { key: "textPrimaryColor", label: "Body text", hint: "Primary message text" },
  // textSecondaryColor is intentionally not included in website scan suggestions because it
  // is always auto-derived as a lighter shade of body text in widgetThemeToChatTheme().
  // It is editable here to allow manual overrides.
  { key: "textSecondaryColor", label: "Muted text", hint: "Timestamps and secondary labels — auto-derived from body text if not manually set" },
];

function mergeTheme(base: WidgetThemeSettings, incoming?: Partial<WidgetThemeSettings>) {
  if (!incoming) {
    return normalizeWidgetTheme(base);
  }

  return normalizeWidgetTheme({
    ...base,
    ...incoming,
    logoUrl: incoming.logoUrl ?? base.logoUrl,
    headerBackground: {
      ...base.headerBackground,
      ...(incoming.headerBackground ?? {}),
      mode: incoming.headerBackground?.mode ?? base.headerBackground?.mode ?? "solid",
      gradient: {
        ...(base.headerBackground?.gradient ?? {}),
        ...(incoming.headerBackground?.gradient ?? {}),
      },
    },
    quickActions: {
      ...base.quickActions,
      ...(incoming.quickActions ?? {}),
    },
    sendButton: {
      ...base.sendButton,
      ...(incoming.sendButton ?? {}),
    },
  });
}

function toDraftTheme(theme: WidgetThemeSettings, logoUrl: string): WidgetThemeSettings {
  return normalizeWidgetTheme({
    ...theme,
    logoUrl: logoUrl.trim() || undefined,
  });
}

export default function WidgetPage() {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const activeLocation = useActiveLocation();
  const scope = resolveChatScope(activeLocation);
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to customize chat appearance and grab the install snippet."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <WidgetEditor key={business.id} business={business} activeLocationSlug={scope.locationSlug} />;
}

function WidgetEditor({ business, activeLocationSlug }: { business: BusinessProfile; activeLocationSlug?: string }) {
  const { setDraftTheme } = usePreviewDock();
  const [theme, setTheme] = useState<WidgetThemeSettings>(() => normalizeWidgetTheme({ ...business.theme }));
  const [logoUrl, setLogoUrl] = useState<string>(() => business.theme.logoUrl ?? "");
  const [persistedTheme, setPersistedTheme] = useState<WidgetThemeSettings>(() => normalizeWidgetTheme({ ...business.theme }));
  const [loaded, setLoaded] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const businessSlug = (business.businessSlug ?? business.slug).trim();
  const locationSlug = activeLocationSlug?.trim() ?? "";
  const hasLocationScope = Boolean(locationSlug);
  const draftTheme = useMemo(() => toDraftTheme(theme, logoUrl), [logoUrl, theme]);
  const isDirty = useMemo(() => JSON.stringify(draftTheme) !== JSON.stringify(persistedTheme), [draftTheme, persistedTheme]);

  const snippet = useMemo(() => {
    const snippetBusinessSlug = business.businessSlug ?? business.slug;
    const snippetLocationSlug = business.locationSlug ?? business.slug;
    return `<script async src="https://cdn.tandem.dev/widget.js" data-business="${snippetBusinessSlug}" data-location="${snippetLocationSlug}"></script>`;
  }, [business.businessSlug, business.locationSlug, business.slug]);

  useEffect(() => {
    const baseTheme = normalizeWidgetTheme({ ...business.theme });
    setTheme(baseTheme);
    setLogoUrl(baseTheme.logoUrl ?? "");
    setPersistedTheme(baseTheme);
    setLoaded(false);
    setLoadingTheme(false);
    setSaveError(null);
    setSaveSuccess(null);
  }, [business.id, business.theme]);

  useEffect(() => {
    setDraftTheme(draftTheme);
    return () => {
      setDraftTheme(undefined);
    };
  }, [draftTheme, setDraftTheme]);

  useEffect(() => {
    setSaveSuccess((current) => (current ? null : current));
  }, [draftTheme]);

  useEffect(() => {
    if (!hasLocationScope || !businessSlug) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadTheme = async () => {
      setLoadingTheme(true);
      try {
        const scopedUrl = `/api/widget-theme?businessSlug=${encodeURIComponent(businessSlug)}&locationSlug=${encodeURIComponent(locationSlug)}`;
        const scopedResponse = await fetch(scopedUrl, {
          method: "GET",
          signal: controller.signal,
        });

        if (!scopedResponse.ok) {
          return;
        }

        const payload = (await scopedResponse.json()) as { theme?: Partial<WidgetThemeSettings> };
        if (cancelled || !payload.theme) {
          return;
        }

          const merged = mergeTheme(normalizeWidgetTheme({ ...business.theme }), payload.theme);
        setTheme(merged);
        setLogoUrl(merged.logoUrl ?? "");
        setPersistedTheme(merged);
      } catch {
        // no-op on load failure; keep local defaults
      } finally {
        if (!cancelled) {
          setLoadingTheme(false);
          setLoaded(true);
        }
      }
    };

    void loadTheme();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [business.id, business.theme, businessSlug, hasLocationScope, locationSlug]);

  const handleThemeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasLocationScope || !businessSlug || savingTheme || loadingTheme) {
      return;
    }

    setSavingTheme(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch(`/api/widget-theme?businessSlug=${encodeURIComponent(businessSlug)}&locationSlug=${encodeURIComponent(locationSlug)}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          theme: draftTheme,
          locationName: business.locationName,
          locationAddress: business.location,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Failed to save theme" }))) as { error?: string };
        throw new Error(payload.error || "Failed to save theme");
      }

      updateBusiness(business.id, (draft) => {
        draft.theme = draftTheme;
      });
      setPersistedTheme(draftTheme);
      setSaveSuccess(`Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save theme";
      setSaveError(message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setTheme(persistedTheme);
    setLogoUrl(persistedTheme.logoUrl ?? "");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleBrandColorChange = (value: string) => {
    setTheme((prev) =>
      normalizeWidgetTheme({
        ...prev,
        primaryColor: value,
        headerBackground: {
          ...prev.headerBackground,
          mode: "solid",
          solidColor: value,
        },
      }),
    );
  };

  const handleAccentColorChange = (value: string) => {
    setTheme((prev) =>
      normalizeWidgetTheme({
        ...prev,
        accentColor: value,
        quickActions: { ...prev.quickActions, color: value },
        sendButton: { ...prev.sendButton, color: value },
      }),
    );
  };

  const updateBaseColor = (key: BaseColorField["key"], value: string) => {
    setTheme((prev) => normalizeWidgetTheme({ ...prev, [key]: value }));
  };

  if (!loaded) return <PageLoader />;

  return (
    <div className="space-y-8">
      <SectionCard
        title="Chat appearance"
        description="Keep your website chat experience on-brand and easy to use."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <form className="space-y-6" onSubmit={handleThemeSubmit}>

          {/* ── Header & brand ── */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Header &amp; brand</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text)]">Brand color</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Chat header, user message bubbles, and primary CTA</p>
                </div>
                <div className="flex items-center gap-2">
                  <ColorSwatchPicker
                    label="Brand color"
                    value={theme.headerBackground?.solidColor ?? theme.primaryColor}
                    onChange={handleBrandColorChange}
                  />
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{theme.headerBackground?.solidColor ?? theme.primaryColor}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text)]">Accent color</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Quick-reply chips and send button</p>
                </div>
                <div className="flex items-center gap-2">
                  <ColorSwatchPicker
                    label="Accent color"
                    value={theme.quickActions?.color ?? theme.accentColor}
                    onChange={handleAccentColorChange}
                  />
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{theme.quickActions?.color ?? theme.accentColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Chat surface & text ── */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Chat surface &amp; text</p>
            <div className="grid gap-4 md:grid-cols-2">
              {textAndSurfaceFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text)]">{field.label}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{field.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ColorSwatchPicker
                      label={field.label}
                      value={theme[field.key]}
                      onChange={(value) => updateBaseColor(field.key, value)}
                    />
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{theme[field.key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Typography & identity ── */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Typography &amp; identity</p>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Font family"
                value={theme.fontFamily}
                onChange={(value) => setTheme((prev) => normalizeWidgetTheme({ ...prev, fontFamily: value }))}
                placeholder="'Inter', sans-serif"
              />
              <TextInput
                label="Logo URL"
                value={logoUrl}
                onChange={setLogoUrl}
                placeholder="https://cdn.tandem.dev/logo.svg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[var(--text-sm)]">
              {saveError ? <p className="text-[var(--color-danger)]">{saveError}</p> : null}
              {saveSuccess ? <p className="text-[var(--color-success)]">{saveSuccess}</p> : null}
              {loadingTheme ? <p className="text-[var(--color-text-muted)]">Loading saved appearance…</p> : null}
              {!hasLocationScope ? <p className="text-[var(--color-warning)]">Select a location to configure appearance.</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={savingTheme || loadingTheme || !isDirty || !hasLocationScope}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset to saved
              </button>
              <button
                type="submit"
                disabled={savingTheme || loadingTheme || !isDirty || !hasLocationScope}
                className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 text-[var(--text-sm)] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTheme ? "Saving…" : "Save appearance"}
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Install snippet"
        description="Paste this code in your site header on pages where the chat widget should appear."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-inverse)] p-4 text-[var(--text-sm)] text-[var(--color-text-inverse)]">
          <code suppressHydrationWarning>{snippet}</code>
        </pre>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2 text-[var(--text-sm)] font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
          >
            {copied ? "Copied" : "Copy snippet"}
          </button>
          <a
            href="https://docs.tandem.dev/widget-install"
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-2 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
          >
            View docs
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
