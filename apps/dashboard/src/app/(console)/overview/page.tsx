'use client';

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useActiveLocation, useIsLocationsServerFetched, useIsStoreHydrated, useConfigStoreVersion } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { resolveChatScope } from "@/lib/chat-scope";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { HealthSummaryBar } from "@/components/console/panels/HealthSummaryBar";
import { HoursPanel } from "@/components/console/panels/HoursPanel";
import { KnowledgePanel } from "@/components/console/panels/KnowledgePanel";
import { BehaviorPanel } from "@/components/console/panels/BehaviorPanel";
import { HandoffPanel } from "@/components/console/panels/HandoffPanel";
import { RecentConversationsPanel } from "@/components/console/panels/RecentConversationsPanel";
import { WidgetPreviewColumn } from "@/components/console/WidgetPreviewColumn";

type ConversationSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string | null;
  isUnread?: boolean;
  status?: string | null;
};

function OverviewContent() {
  const { openCreateLocation } = useConsoleDialogs();
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const location = useActiveLocation();
  const scope = useMemo(() => resolveChatScope(location), [location]);
  const { prefillInput } = useAISidebar();

  // Re-fetch conversations whenever a confirmed AI change bumps config version
  const configVersion = useConfigStoreVersion();

  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  useEffect(() => {
    if (!scope.businessId || !scope.locationSlug) return;
    let dead = false;

    async function load() {
      setLoadingConversations(true);
      setSessions([]);
      try {
        const r = await fetch(
          `/api/conversations?businessId=${encodeURIComponent(scope.businessId!)}&locationSlug=${encodeURIComponent(scope.locationSlug!)}&range=30d`
        );
        const d = r.ok ? await r.json() : { sessions: [] };
        if (!dead) setSessions(Array.isArray(d.sessions) ? d.sessions : []);
      } catch {
        if (!dead) setSessions([]);
      } finally {
        if (!dead) setLoadingConversations(false);
      }
    }

    load();
    return () => {
      dead = true;
    };
    // configVersion intentionally included to re-fetch after confirmed AI writes
  }, [scope.businessId, scope.locationSlug, configVersion]);

  if (!hydrated || (!location && !locationsFetched)) return <PageLoader />;

  if (!location) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-light)]">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Welcome to Tandem</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Create your first location to launch your AI chatbot. It only takes a few minutes.
          </p>
          <button
            type="button"
            onClick={openCreateLocation}
            className="mt-6 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Create your first location
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {location.locationName ?? location.name}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          {location.location || "No address set"}
          {location.timezone && location.timezone !== "UTC" ? ` � ${location.timezone}` : ""}
        </p>
        <div className="mt-3">
          <HealthSummaryBar location={location} />
        </div>
      </div>

      {/* Two-column layout: state panels (left) + widget preview (right) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column: chatbot state panels */}
        <div className="space-y-5">
          <HoursPanel location={location} onPromptChip={prefillInput} />
          <KnowledgePanel location={location} onPromptChip={prefillInput} />
          <BehaviorPanel location={location} onPromptChip={prefillInput} />
          <HandoffPanel location={location} onPromptChip={prefillInput} />
          <RecentConversationsPanel
            sessions={sessions}
            loading={loadingConversations}
            businessId={scope.businessId}
            locationSlug={scope.locationSlug}
          />
          <div className="pb-2 text-center">
            <Link
              href="/conversations"
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              View all conversations &rarr;
            </Link>
          </div>
        </div>

        {/* Right column: live widget preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <WidgetPreviewColumn location={location} />
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div />}>
      <OverviewContent />
    </Suspense>
  );
}
