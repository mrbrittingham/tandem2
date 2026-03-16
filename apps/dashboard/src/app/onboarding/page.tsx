'use client';

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WebsiteImportPanel } from "@/components/WebsiteImportPanel";
import type { BusinessProfile } from "@tandem/shared";
import { syncLocationsFromServer } from "@/lib/store-hooks";
import {
  initialOnboardingState,
  onboardingReducer,
  slugifyBusinessName,
  type ChatMessage,
} from "./lib/onboarding-state-machine";
import { useImportPolling } from "./hooks/useImportPolling";
import { EmbeddedUrlInput } from "./components/EmbeddedUrlInput";
import { ScanProgressPanel } from "./components/ScanProgressPanel";
import { ScanResultsSummary } from "./components/ScanResultsSummary";
import { HandoffContactInput } from "./components/HandoffContactInput";
import { ManualSetupForm } from "./components/ManualSetupForm";

// ── Types ─────────────────────────────────────────────────────────────────────

type CreateLocationResponse = {
  ok?: boolean;
  location?: {
    id: string;
    business_id: string;
    slug: string;
    name: string;
  } | null;
  error?: string;
};

type StartImportResponse = {
  ok?: boolean;
  runId?: string;
  error?: string;
  code?: string;
};

type ApplyImportResponse = {
  ok?: boolean;
  error?: string;
};

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  onScan,
  onSkip,
  onSaveHandoff,
  onSkipHandoff,
  locationId,
  businessId,
  scanDisabled,
  handoffDisabled,
  handoffPrefillPhone,
  handoffPrefillLink,
}: {
  message: ChatMessage;
  onScan?: (url: string) => void;
  onSkip?: () => void;
  onSaveHandoff?: (data: { phone: string; link: string; email: string }) => void;
  onSkipHandoff?: () => void;
  locationId?: string;
  businessId?: string;
  scanDisabled?: boolean;
  handoffDisabled?: boolean;
  handoffPrefillPhone?: string;
  handoffPrefillLink?: string;
}) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[90%] rounded-[var(--console-radius-md)] px-4 py-3 ${
          isAssistant
            ? "bg-[var(--console-bg-card)] border border-[var(--console-border)] text-[var(--console-text-primary)]"
            : "bg-[var(--console-primary)] text-[var(--console-text-inverse)]"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

        {/* Status lines (appended during scanning) */}
        {message.statusLines && message.statusLines.length > 0 ? (
          <ul className="mt-2 space-y-0.5">
            {message.statusLines.map((line, i) => (
              <li key={i} className="text-xs text-[var(--console-text-secondary)]">
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Embedded URL input */}
        {message.embed === "url-input" && onScan && onSkip ? (
          <EmbeddedUrlInput
            onScan={onScan}
            onSkip={onSkip}
            disabled={scanDisabled}
          />
        ) : null}

        {/* Embedded handoff input */}
        {message.embed === "handoff-input" && locationId && businessId && onSaveHandoff && onSkipHandoff ? (
          <HandoffContactInput
            locationId={locationId}
            businessId={businessId}
            prefillPhone={handoffPrefillPhone}
            prefillLink={handoffPrefillLink}
            onSave={onSaveHandoff}
            onSkip={onSkipHandoff}
            disabled={handoffDisabled}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Business form ─────────────────────────────────────────────────────────────

function BusinessSetupForm({
  onCreated,
}: {
  onCreated: (businessId: string, locationId: string, locationSlug: string, locationName: string) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = businessName.trim().length > 0 && locationName.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Bootstrap the business (create business + membership)
      const businessSlug = slugifyBusinessName(businessName.trim());
      const bootstrapResponse = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: businessSlug, role: "owner" }),
      });

      if (!bootstrapResponse.ok) {
        const payload = (await bootstrapResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create your business");
      }

      // Step 2: Create the first location
      const locationResponse = await fetch("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: locationName.trim(),
          address: address.trim() || undefined,
          mode: "fresh",
        }),
      });

      if (!locationResponse.ok) {
        const payload = (await locationResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create your location");
      }

      const locationPayload = (await locationResponse.json()) as CreateLocationResponse;
      const location = locationPayload.location;

      if (!location?.id || !location.slug) {
        throw new Error("Unexpected response from location creation");
      }

      // Sync the new location into the mock store
      syncLocationsFromServer([
        {
          id: location.id,
          businessId: location.business_id,
          slug: location.slug,
          name: location.name,
          address: address.trim(),
        },
      ]);

      onCreated(location.business_id, location.id, location.slug, location.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">
          Getting started
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--console-text-primary)]">
          Tell me about your restaurant
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-[var(--console-text-secondary)]">
          <span className="mb-1 block font-medium">Restaurant name</span>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
            placeholder="Windmill Creek Winery"
          />
        </label>

        <label className="block text-sm text-[var(--console-text-secondary)]">
          <span className="mb-1 block font-medium">Location name</span>
          <input
            required
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
            placeholder="Berlin"
          />
        </label>

        <label className="block text-sm text-[var(--console-text-secondary)]">
          <span className="mb-1 block font-medium">Address (optional)</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
            placeholder="11206 Worcester Hwy, Berlin, MD 21811"
          />
        </label>

        {error ? (
          <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-sm text-[var(--console-error)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Setting up…" : "Get started →"}
        </button>
      </form>
    </div>
  );
}

// ── Completion panel ──────────────────────────────────────────────────────────

function CompletionPanel({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        🎉
      </div>
      <div>
        <p className="text-lg font-semibold text-[var(--console-text-primary)]">
          Your chatbot is ready!
        </p>
        <p className="mt-1 text-sm text-[var(--console-text-secondary)]">
          Head to your dashboard to see it in action and keep configuring.
        </p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
      >
        → Go to my dashboard
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Scanning progress tracking ─────────────────────────────────────────────
  const polling = useImportPolling(state.stage === "scanning" ? state.runId : null);
  const seenPageCountRef = useRef(0);
  const lastScanningMessageIdRef = useRef<string | null>(null);

  // Track the last scanning message ID when entering scanning stage
  useEffect(() => {
    if (state.stage === "scanning") {
      const lastMsg = state.chatMessages[state.chatMessages.length - 1];
      if (lastMsg?.role === "assistant") {
        lastScanningMessageIdRef.current = lastMsg.id;
      }
    }
  }, [state.stage, state.chatMessages]);

  // Update pages in state from polling
  useEffect(() => {
    if (state.stage !== "scanning") return;
    if (polling.pages.length > 0 && polling.pages.length !== state.scanPages.length) {
      dispatch({ type: "SCAN_PAGES_UPDATED", pages: polling.pages });
    }
  }, [state.stage, state.scanPages.length, polling.pages]);

  // Add status lines as new pages are found
  useEffect(() => {
    if (state.stage !== "scanning") return;
    if (!lastScanningMessageIdRef.current) return;

    const newPages = polling.pages.slice(seenPageCountRef.current);
    if (newPages.length === 0) return;

    seenPageCountRef.current = polling.pages.length;

    for (const page of newPages) {
      const label = getPageTypeStatusLine(page.pageType, page.title);
      if (label) {
        dispatch({
          type: "ADD_STATUS_LINE",
          messageId: lastScanningMessageIdRef.current,
          line: label,
        });
      }
    }
  }, [state.stage, polling.pages]);

  // Handle terminal polling states
  useEffect(() => {
    if (state.stage !== "scanning") return;

    if (polling.status === "succeeded" && polling.draft) {
      dispatch({ type: "SCAN_SUCCEEDED", draft: polling.draft });
    } else if (polling.status === "failed") {
      dispatch({
        type: "SCAN_FAILED",
        error: { code: polling.errorCode, message: polling.errorMessage ?? "Scan failed" },
      });
    }
  }, [state.stage, polling.status, polling.draft, polling.errorCode, polling.errorMessage]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chatMessages]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBusinessCreated = (
    businessId: string,
    locationId: string,
    locationSlug: string,
    locationName: string,
  ) => {
    dispatch({
      type: "BUSINESS_CREATED",
      businessData: { name: locationName, slug: businessId },
      locationData: { id: locationId, businessId, slug: locationSlug, name: locationName },
    });
  };

  const handleScanStart = async (url: string) => {
    if (!state.locationData) return;

    const { businessId, slug: locationSlug } = state.locationData;

    try {
      const response = await fetch("/api/website-import/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId,
          locationSlug,
          url,
          source: "onboarding",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as StartImportResponse;

      if (!response.ok || !payload.runId) {
        dispatch({
          type: "SCAN_FAILED",
          error: {
            code: payload.code ?? null,
            message: payload.error ?? "Failed to start scan",
          },
        });
        return;
      }

      dispatch({ type: "SCAN_STARTED", runId: payload.runId, url });
    } catch {
      dispatch({
        type: "SCAN_FAILED",
        error: { code: null, message: "Network error — could not start scan" },
      });
    }
  };

  const handleApplyDraft = async () => {
    if (!state.runId || isApplyingDraft) return;

    setIsApplyingDraft(true);

    try {
      const response = await fetch(`/api/website-import/${state.runId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => ({}))) as ApplyImportResponse;

      if (!response.ok) {
        // Apply failed — fall through to handoff anyway (non-blocking)
        console.warn("[onboarding] apply draft failed:", payload.error);
      }

      dispatch({ type: "APPLY_DRAFT" });
    } catch (err) {
      console.warn("[onboarding] apply draft error:", err);
      dispatch({ type: "APPLY_DRAFT" });
    } finally {
      setIsApplyingDraft(false);
    }
  };

  const handleHandoffSaved = () => {
    dispatch({ type: "HANDOFF_SAVED" });
  };

  const handleHandoffSkipped = () => {
    dispatch({ type: "HANDOFF_SKIPPED" });
  };

  const handleManualSaved = () => {
    dispatch({
      type: "APPEND_CHAT_MESSAGES",
      messages: [
        {
          id: `manual-saved-${Date.now()}`,
          role: "assistant",
          content:
            "Got it — I've saved your details. Now let's set up your team's contact information so guests know how to reach you.",
        },
      ],
    });
    dispatch({ type: "APPLY_DRAFT" }); // transitions to handoff stage
  };

  const handleContinueToDashboard = () => {
    router.replace("/overview");
    router.refresh();
  };

  // ── Get prefill data for handoff from scan ─────────────────────────────────
  const handoffPrefillPhone = state.scanDraft?.businessProfile.phone.value ?? "";
  const handoffPrefillLink = state.scanDraft?.restaurantKnowledge.reservations.bookingUrl ?? "";

  // ── Latest URL-input embed (only active on most recent message with embed) ──
  const lastUrlEmbedId = state.chatMessages
    .slice()
    .reverse()
    .find((m) => m.embed === "url-input")?.id;

  const lastHandoffEmbedId = state.chatMessages
    .slice()
    .reverse()
    .find((m) => m.embed === "handoff-input")?.id;

  // ── Right panel content ────────────────────────────────────────────────────
  const rightPanel = (() => {
    switch (state.stage) {
      case "business-form":
        return (
          <BusinessSetupForm onCreated={handleBusinessCreated} />
        );

      case "website-url":
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-sm text-[var(--console-text-secondary)] max-w-xs">
              Your chatbot preview will appear here once setup is complete.
            </p>
          </div>
        );

      case "scanning":
        return (
          <ScanProgressPanel
            url={state.scanUrl ?? ""}
            pages={state.scanPages}
            status={polling.status}
          />
        );

      case "scan-results":
        return state.scanDraft ? (
          <ScanResultsSummary
            draft={state.scanDraft}
            onApply={handleApplyDraft}
            onReview={() => dispatch({ type: "REVIEW_DRAFT" })}
            isApplying={isApplyingDraft}
          />
        ) : null;

      case "scan-review":
        return state.locationData ? (
          <div className="h-full overflow-y-auto">
            <WebsiteImportPanel
              business={{
                id: state.locationData.id,
                slug: state.locationData.businessId,
                name: state.locationData.name,
                businessSlug: state.locationData.businessId,
                locationSlug: state.locationData.slug,
                industry: "restaurant",
                timezone: "America/New_York",
                tagline: "",
                summary: "",
                location: "",
                contacts: [],
                hours: [],
                intents: [],
                faqs: [],
                policies: [],
                integrations: [],
                theme: {} as BusinessProfile["theme"],
                handoff: {} as BusinessProfile["handoff"],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }}
            />
          </div>
        ) : null;

      case "manual-setup":
        return state.locationData ? (
          <ManualSetupForm
            locationId={state.locationData.id}
            businessId={state.locationData.businessId}
            onSave={handleManualSaved}
          />
        ) : null;

      case "handoff":
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-5xl mb-4">📞</div>
            <p className="text-sm text-[var(--console-text-secondary)] max-w-xs">
              Add your team&apos;s contact info so guests can always reach a person when they need one.
            </p>
          </div>
        );

      case "complete":
        return <CompletionPanel onContinue={handleContinueToDashboard} />;

      default:
        return null;
    }
  })();

  return (
    <main className="flex min-h-screen bg-[var(--bg)]">
      {/* ── Left column: AI chat ────────────────────────────────────────── */}
      <div className="flex w-full flex-col border-r border-[var(--console-border)] bg-[var(--console-bg)] md:w-1/2 lg:w-[45%]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--console-border)] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--console-primary)] text-sm font-bold text-white">
            T
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--console-text-primary)]">Tandem</p>
            <p className="text-xs text-[var(--console-text-tertiary)]">Restaurant AI Setup</p>
          </div>
          <a
            href="/overview"
            className="ml-auto text-xs text-[var(--console-text-tertiary)] hover:text-[var(--console-text-secondary)]"
          >
            Skip to dashboard
          </a>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {state.chatMessages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onScan={message.embed === "url-input" && message.id === lastUrlEmbedId
                ? handleScanStart
                : undefined}
              onSkip={message.embed === "url-input" && message.id === lastUrlEmbedId
                ? () => dispatch({ type: "SKIP_SCAN" })
                : undefined}
              onSaveHandoff={message.embed === "handoff-input" && message.id === lastHandoffEmbedId
                ? handleHandoffSaved
                : undefined}
              onSkipHandoff={message.embed === "handoff-input" && message.id === lastHandoffEmbedId
                ? handleHandoffSkipped
                : undefined}
              locationId={state.locationData?.id}
              businessId={state.locationData?.businessId}
              scanDisabled={state.stage !== "website-url"}
              handoffDisabled={state.stage !== "handoff"}
              handoffPrefillPhone={handoffPrefillPhone}
              handoffPrefillLink={handoffPrefillLink}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Right column: contextual panel ─────────────────────────────── */}
      <div className="hidden flex-col bg-[var(--console-bg-card)] md:flex md:w-1/2 lg:w-[55%]">
        <div className="flex-1 overflow-y-auto">
          {rightPanel}
        </div>
      </div>
    </main>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPageTypeStatusLine(
  pageType: string | undefined,
  title: string,
): string | null {
  if (!pageType) return null;

  const map: Record<string, string> = {
    menu: "Reading your menu",
    hours: "Found your hours page",
    contact: "Found contact details",
    reservations: "Reading reservations info",
    events: "Found events page",
    faq: "Checking your FAQ page",
    about: "Reading about page",
    policies: "Found policies page",
    memberships: "Found memberships page",
    "private-events": "Found private dining info",
    catering: "Found catering info",
    home: `Read homepage: ${title}`,
  };

  const label = map[pageType] ?? (pageType !== "general" ? `Found: ${title}` : null);
  return label ? `✓ ${label}` : null;
}
