"use client";

import { useMemo } from "react";
import { ChatWidget, resolveWidgetRuntimeConfig } from "@tandem/ui-kit";
import type { WidgetThemeSettings, BusinessProfile } from "@tandem/shared";
import { resolveChatScope } from "@/lib/chat-scope";
import { businessToWidgetConfig } from "@/lib/store-hooks";
import { widgetThemeToChatTheme } from "@/lib/widget-theme";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  activeBusiness: BusinessProfile | undefined;
  draftTheme: WidgetThemeSettings | undefined;
  isClientMounted: boolean;
};

export function PreviewPanel({ isOpen, onClose, activeBusiness, draftTheme, isClientMounted }: Props) {
  const widgetConfig = useMemo(
    () => (activeBusiness ? businessToWidgetConfig(activeBusiness) : undefined),
    [activeBusiness],
  );

  const widgetTheme = useMemo(() => {
    const themeSource = draftTheme ?? activeBusiness?.theme;
    return themeSource ? widgetThemeToChatTheme(themeSource) : undefined;
  }, [activeBusiness?.theme, draftTheme]);

  const previewRuntimeConfig = useMemo(
    () => {
      const scope = resolveChatScope(activeBusiness);
      const resolved = resolveWidgetRuntimeConfig({
        businessId: scope.businessId,
        businessSlug: scope.businessSlug,
        locationId: scope.locationId,
        locationSlug: scope.locationSlug,
      });
      // TEMP DEBUG: Remove after diagnosing missing business identifier
      console.log("PREVIEW DEBUG activeBusiness", activeBusiness ? JSON.parse(JSON.stringify(activeBusiness)) : undefined);
      console.log("PREVIEW DEBUG resolveChatScope result", scope);
      console.log("PREVIEW DEBUG previewRuntimeConfig", resolved);
      console.log("PREVIEW DEBUG ChatWidget props", {
        businessId: resolved.businessId,
        businessSlug: resolved.businessSlug,
        locationId: resolved.locationId,
        locationSlug: resolved.locationSlug,
        apiBaseUrl: resolved.apiBaseUrl,
        isValid: resolved.isValid,
        error: resolved.error,
      });
      try {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("tandem:mock-state") : null;
        console.log("PREVIEW DEBUG localStorage tandem:mock-state", stored ? JSON.parse(stored) : null);
      } catch {
        console.log("PREVIEW DEBUG localStorage read failed");
      }
      return resolved;
    },
    [activeBusiness],
  );

  return (
    <>
      {/* FAB launcher */}
      <button
        type="button"
        onClick={onClose} // re-purpose: parent toggles
        disabled={!widgetConfig}
        className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-2xl shadow-slate-900/30 transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <svg aria-hidden className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M5 5h14v10H8l-3 3Z" />
        </svg>
        <span className="sr-only">{isOpen ? "Close preview" : "Open preview"}</span>
      </button>

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)] transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[var(--color-text-muted)]">Preview</p>
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Chatbot experience</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:border-[var(--color-border-strong)]"
          >
            <span className="sr-only">Close preview</span>
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4l8 8m0-8l-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex h-full flex-col gap-4 overflow-hidden bg-[var(--color-surface-hover)] px-4 py-6">
          {widgetConfig && isClientMounted ? (
            <div className="mx-auto h-[600px] w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]">
              <ChatWidget
                config={widgetConfig}
                theme={widgetTheme}
                businessId={previewRuntimeConfig.businessId}
                businessSlug={previewRuntimeConfig.businessSlug}
                locationId={previewRuntimeConfig.locationId}
                locationSlug={previewRuntimeConfig.locationSlug}
                apiBaseUrl={previewRuntimeConfig.apiBaseUrl}
                hydrateHistory={false}
                initiallyOpen={isOpen}
                showLauncher={false}
                onClose={onClose}
              />
            </div>
          ) : widgetConfig ? (
            <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Loading preview…</p>
          ) : (
            <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Select or create a location to load a live preview.</p>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen ? (
        <button
          type="button"
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-sm"
        />
      ) : null}
    </>
  );
}
