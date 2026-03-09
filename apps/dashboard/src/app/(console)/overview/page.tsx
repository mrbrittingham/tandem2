'use client';

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { resolveChatScope } from "@/lib/chat-scope";
import { useActiveBusiness, useActiveLocation } from "@/lib/store-hooks";

const checklistConfig = [
  {
    label: "Add location",
    description: "Create a location and set details.",
    href: "/locations",
    key: "location",
  },
  {
    label: "Add at least 3 common questions",
    description: "Publish your most common customer answers.",
    href: "/knowledge",
    key: "faqs",
  },
  {
    label: "Set how customers reach you",
    description: "Enable at least one contact method.",
    href: "/handoff",
    key: "handoff",
  },
  {
    label: "Add chat to your website",
    description: "Install the website chat code.",
    href: "/widget",
    key: "widget",
  },
  {
    label: "Test your assistant",
    description: "Run a test conversation.",
    href: "/intents",
    key: "test",
  },
] as const;

type RangeKey = "7d" | "30d" | "90d";

type ConversationSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string; days: number }> = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

function parseRange(value: string | null): RangeKey {
  if (value === "7d" || value === "30d" || value === "90d") {
    return value;
  }
  return "30d";
}

function rangeDays(range: RangeKey) {
  return RANGE_OPTIONS.find((item) => item.value === range)?.days ?? 30;
}

function formatUtcMDY(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
}

function toTimestamp(value?: string | null) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

function formatRangeLabel(value: string) {
  return value.slice(5).replace("-", "/");
}

function OverviewPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openCreateLocation } = useConsoleDialogs();
  const business = useActiveBusiness();
  const activeLocation = useActiveLocation();
  const previewDock = usePreviewDock();
  const selectedRange = parseRange(searchParams.get("range"));
  const scope = useMemo(() => resolveChatScope(activeLocation), [activeLocation]);
  const businessId = scope.businessId;
  const locationSlug = scope.locationSlug;
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasScope = Boolean(businessId && locationSlug);

  useEffect(() => {
    const scopedBusinessId = businessId;
    const scopedLocationSlug = locationSlug;
    if (!scopedBusinessId || !scopedLocationSlug) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSessionsLoading(true);
      setSessionsError(null);
    });

    const url = `/api/conversations?businessId=${encodeURIComponent(scopedBusinessId)}&locationSlug=${encodeURIComponent(scopedLocationSlug)}&range=${selectedRange}`;
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error ?? "Failed to load conversations");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSessions((payload.sessions ?? []) as ConversationSession[]);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setSessions([]);
        setSessionsError(error instanceof Error ? error.message : "Failed to load conversations");
      })
      .finally(() => {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [businessId, locationSlug, selectedRange]);

  const updateRange = (nextRange: RangeKey) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", nextRange);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const snippet = useMemo(() => {
    const snippetBusinessId = business?.businessSlug ?? business?.slug ?? "business";
    const snippetLocationSlug = business?.locationSlug ?? business?.slug ?? "location";
    return `<script async src="https://cdn.tandem.dev/widget.js" data-business="${snippetBusinessId}" data-location="${snippetLocationSlug}"></script>`;
  }, [business?.businessSlug, business?.locationSlug, business?.slug]);

  const latestKnowledgeUpdate = useMemo(() => {
    if (!business) {
      return undefined;
    }

    return [...business.faqs, ...business.policies]
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [business]);

  const rangeSessionData = useMemo(() => {
    const sessionsForRange = hasScope ? sessions : [];
    if (!sessionsForRange.length) {
      return {
        filtered: [] as ConversationSession[],
        daily: [] as Array<{ label: string; count: number }>,
        activeDays: 0,
      };
    }

    const newestTimestamp = sessionsForRange.reduce((latest, session) => {
      const timestamp = toTimestamp(session.createdAt);
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      return Math.max(latest, timestamp);
    }, 0);

    if (newestTimestamp <= 0) {
      return {
        filtered: [] as ConversationSession[],
        daily: [] as Array<{ label: string; count: number }>,
        activeDays: 0,
      };
    }

    const days = rangeDays(selectedRange);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const start = newestTimestamp - (days - 1) * oneDayMs;

    const filtered = sessionsForRange.filter((session) => {
      const timestamp = toTimestamp(session.createdAt);
      return !Number.isNaN(timestamp) && timestamp >= start && timestamp <= newestTimestamp;
    });

    const buckets = new Map<string, number>();
    for (let index = 0; index < days; index += 1) {
      const day = new Date(start + index * oneDayMs);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }

    for (const session of filtered) {
      const key = new Date(session.createdAt).toISOString().slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    const daily = Array.from(buckets.entries()).map(([date, count]) => ({
      label: formatRangeLabel(date),
      count,
    }));
    const activeDays = daily.filter((entry) => entry.count > 0).length;

    return { filtered, daily, activeDays };
  }, [hasScope, selectedRange, sessions]);

  const totalConversations = rangeSessionData.filtered.length;
  const avgPerActiveDay = rangeSessionData.activeDays
    ? (totalConversations / rangeSessionData.activeDays).toFixed(1)
    : "0.0";

  const latestConversation = useMemo(() => {
    const newest = rangeSessionData.filtered.reduce((latest, session) => {
      const timestamp = toTimestamp(session.updatedAt);
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      return Math.max(latest, timestamp);
    }, 0);

    if (!newest) {
      return "—";
    }

    return formatUtcMDY(new Date(newest).toISOString());
  }, [rangeSessionData.filtered]);

  const recentActivity = useMemo(() => {
    if (!business) {
      return [] as Array<{ eventKey: string; label: string; timestamp: string; timestampMs: number }>;
    }

    const latestWidgetSync = business.integrations.find((integration) =>
      integration.category.toLowerCase().includes("website") || integration.name.toLowerCase().includes("widget"),
    )?.lastSynced;

    const events = [
      business.updatedAt
        ? {
            eventKey: "business-updated",
            label: "Business profile updated",
            timestamp: business.updatedAt,
          }
        : null,
      latestKnowledgeUpdate
        ? {
            eventKey: "knowledge-updated",
            label: "Knowledge content updated",
            timestamp: latestKnowledgeUpdate,
          }
        : null,
      latestWidgetSync
        ? {
            eventKey: "widget-synced",
            label: "Widget integration synced",
            timestamp: latestWidgetSync,
          }
        : null,
      sessions[0]?.updatedAt
        ? {
            eventKey: "conversations-updated",
            label: "Conversation activity updated",
            timestamp: sessions[0].updatedAt,
          }
        : null,
    ]
      .filter(Boolean)
      .map((event) => ({
        ...(event as { eventKey: string; label: string; timestamp: string }),
        timestampMs: Date.parse((event as { timestamp: string }).timestamp),
      }))
      .filter((event) => Number.isFinite(event.timestampMs));

    return events
      .sort((a, b) => {
        const primary = b.timestampMs - a.timestampMs;
        if (primary !== 0) {
          return primary;
        }
        if (a.eventKey === b.eventKey) {
          return 0;
        }
        return a.eventKey < b.eventKey ? -1 : 1;
      })
      .slice(0, 6);
  }, [business, latestKnowledgeUpdate, sessions]);

  if (!business) {
    return (
      <EmptyState
        title="Create your first location assistant"
        description="Add a location to unlock setup checklists, preview, and install docs."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const enabledFaqs = business.faqs.filter((faq) => faq.showInHelp);
  const enabledPolicies = business.policies.filter((policy) => policy.showInHelp);
  const liveContacts = business.handoff.contactMethods.filter((method) => method.enabled);
  const widgetIntegration = business.integrations.find((integration) =>
    integration.category.toLowerCase().includes("website") || integration.name.toLowerCase().includes("widget"),
  );

  const locationComplete = Boolean((business.locationName ?? "").trim());
  const faqsComplete = enabledFaqs.length >= 3;
  const contactComplete = liveContacts.length > 0;
  const widgetInstalled = widgetIntegration?.status === "connected";
  const assistantTested = business.intents.length >= 1;
  const checklistProgress: Record<(typeof checklistConfig)[number]["key"], boolean> = {
    location: locationComplete,
    faqs: faqsComplete,
    handoff: contactComplete,
    widget: widgetInstalled,
    test: assistantTested,
  };

  const checklistState = checklistConfig.map((item) => ({
    ...item,
    completed: checklistProgress[item.key],
  }));
  const completedCount = checklistState.filter((item) => item.completed).length;
  const onboardingComplete = completedCount === checklistState.length;

  const latestUpdateIso = [business.updatedAt, latestKnowledgeUpdate]
    .filter(Boolean)
    .sort((a, b) => toTimestamp(b) - toTimestamp(a))[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const visibleSessionsLoading = hasScope ? sessionsLoading : false;
  const visibleSessionsError = hasScope ? sessionsError : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Assistant performance"
          description="Conversation trends for this location."
          headerDivider={false}
          headerClassName="mb-3 pb-0"
          bodyClassName="space-y-0"
          actions={
            <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateRange(option.value)}
                  className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[var(--text-xs)] font-medium transition-all ${
                    selectedRange === option.value
                      ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {option.label.replace("Last ", "")}
                </button>
              ))}
            </div>
          }
        >
          {hasScope ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Total conversations" value={String(totalConversations)} helper={`${rangeDays(selectedRange)}-day range`} />
              <MetricTile label="Active days" value={String(rangeSessionData.activeDays)} helper="Days with at least one conversation" />
              <MetricTile label="Avg conversations / active day" value={String(avgPerActiveDay)} helper="Based on conversation created date" />
              <MetricTile label="Latest conversation" value={latestConversation} helper="Most recent conversation update" />
            </div>
          ) : (
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Select a location to load conversation performance.</p>
          )}
          {visibleSessionsLoading ? <p className="mt-3 text-[var(--text-xs)] text-[var(--color-text-muted)]">Loading conversation metrics…</p> : null}
          {visibleSessionsError ? <p className="mt-3 text-[var(--text-xs)] text-[var(--color-danger)]">{visibleSessionsError}</p> : null}
        </SectionCard>

        <SectionCard
          title="Website chat setup"
          description="Installation status and embed code."
          headerDivider={false}
          headerClassName="mb-3 pb-0"
          bodyClassName="space-y-0"
        >
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className={`flex h-2 w-2 rounded-full ${widgetInstalled ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`} />
              <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text)]">{widgetInstalled ? "Installed" : "Not detected"}</p>
            </div>
            <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
              Detected when your site integration reports as connected.
            </p>
            {widgetIntegration?.lastSynced ? (
              <p className="mt-1 text-[var(--text-xs)] tabular-nums text-[var(--color-text-muted)]">Last signal: {formatUtcMDY(widgetIntegration.lastSynced)}</p>
            ) : null}
          </div>
          <pre className="mt-3 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-code-bg)] p-3 text-[var(--text-xs)] leading-relaxed text-[var(--color-text-inverse)]">
            <code suppressHydrationWarning>{snippet}</code>
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-[var(--text-sm)] font-medium text-white shadow-[var(--shadow-xs)] transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-sm)] active:scale-[0.98]"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><path d="M2 9V2.5A.5.5 0 0 1 2.5 2H9" /></svg>
              {copied ? "Copied!" : "Copy code"}
            </button>
            <Link href="/widget" className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]">
              Widget settings
            </Link>
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]"
            >
              Preview
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={!onboardingComplete ? "Launch checklist" : "Assistant health"}
          description={!onboardingComplete ? "Complete these steps to go live." : "Current readiness signals."}
          headerDivider={false}
          headerClassName="mb-3 pb-0"
          bodyClassName="space-y-0"
          actions={!onboardingComplete ? (
            <div className="flex items-center gap-2">
              <div className="flex h-5 items-center">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                    style={{ width: `${(completedCount / checklistState.length) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)]">{completedCount}/{checklistState.length}</span>
            </div>
          ) : undefined}
        >
          {!onboardingComplete ? (
            <>
              <div className="space-y-2">
                {checklistState.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-[var(--radius-lg)] border px-3.5 py-3 transition-all ${
                      item.completed
                        ? "border-[var(--color-success)]/20 bg-[var(--color-success-light)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-xs)]"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      item.completed
                        ? "bg-[var(--color-success)] text-white"
                        : "border-2 border-[var(--color-border-strong)] text-transparent group-hover:border-[var(--color-primary)]"
                    }`}>
                      {item.completed ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">{item.label}</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{item.description}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
                      item.completed ? "text-[var(--color-success)]" : "text-[var(--color-text-disabled)]"
                    }`}>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <HealthRow label="Knowledge coverage" value={`${enabledFaqs.length} FAQs, ${enabledPolicies.length} Policies`} href="/knowledge" />
                <HealthRow label="Handoff configured" value={liveContacts.length > 0 ? "Yes" : "No"} href="/handoff" />
                <HealthRow label="Website installed" value={widgetInstalled ? "Installed" : "Not detected"} href="/widget" />
                <HealthRow label="Last updated" value={latestUpdateIso ? formatUtcMDY(latestUpdateIso) : "—"} href="/conversations" />
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Conversation activity"
          description="Daily volume for the selected range."
          headerDivider={false}
          headerClassName="mb-3 pb-0"
          bodyClassName="space-y-0"
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
                {(["7d", "30d", "90d"] as RangeKey[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateRange(r)}
                    className={`rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] font-medium transition-all ${
                      selectedRange === r
                        ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Link href="/conversations" className="text-[var(--text-sm)] font-medium text-[var(--color-primary)] hover:underline">
                View all
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Total conversations" value={String(totalConversations)} helper={`${rangeDays(selectedRange)}-day range`} />
            <MetricTile label="Avg conversations / day" value={String(avgPerActiveDay)} helper="Across active days" />
          </div>
          <div className="mt-4">
            <ActivityLineChart data={rangeSessionData.daily} />
          </div>
        </SectionCard>

        <SectionCard
          title="Recent updates"
          description="Latest changes across your setup."
          headerDivider={false}
          headerClassName="mb-3 pb-0"
          bodyClassName="space-y-0"
        >
          <div className="space-y-2">
            {recentActivity.length ? (
              recentActivity.map((event) => (
                <div key={event.eventKey} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"></div>
                    </div>
                    <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">{event.label}</p>
                  </div>
                  <p className="text-[var(--text-xs)] tabular-nums text-[var(--color-text-muted)]">{formatUtcMDY(event.timestamp)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-5 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                No recent activity yet. Use Preview to send a test message.
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href="/conversations" className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><path d="M3 7h3.6a1 1 0 0 1 .8.4l.6.8a1 1 0 0 0 .8.4h.4a1 1 0 0 0 .8-.4l.6-.8a1 1 0 0 1 .8-.4H14" /><rect x="1" y="1" width="12" height="12" rx="2" /></svg>
              Open conversations
            </Link>
            <Link href="/knowledge" className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><path d="M2 11V3a1.5 1.5 0 0 1 1.5-1.5H12v9H3.5A1.5 1.5 0 0 0 2 12Z" /><path d="M2 11a1.5 1.5 0 0 1 1.5-1.5H12v3H3.5A1.5 1.5 0 0 1 2 11Z" /></svg>
              Update Knowledge
            </Link>
            <Link href="/handoff" className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><path d="M11 3 6 8" /><path d="M11 3h-3" /><path d="M11 3v3" /><path d="M3 11l5-5" /></svg>
              Configure Handoff
            </Link>
            <Link href="/widget" className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><circle cx="7" cy="7" r="5.5" /><circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" /><circle cx="8.5" cy="5.5" r="0.75" fill="currentColor" /></svg>
              Widget settings
            </Link>
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] hover:shadow-[var(--shadow-xs)] sm:col-span-2"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><rect x="1" y="2" width="12" height="10" rx="2" /><path d="M1 5h12" /></svg>
              Preview
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div />}>
      <OverviewPageClient />
    </Suspense>
  );
}

function MetricTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="group rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-4 py-3.5 transition-colors hover:border-[var(--color-border)]">
      <p className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">{helper}</p>
    </article>
  );
}

function HealthRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-3.5 py-2.5 transition-colors hover:border-[var(--color-border-strong)]">
      <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">{value}</span>
    </Link>
  );
}

function ActivityLineChart({ data }: { data: Array<{ label: string; count: number }> }) {
  if (!data.length) {
    return <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">No conversations available for this range.</p>;
  }

  const width = 640;
  const height = 220;
  const leftPad = 24;
  const rightPad = 12;
  const topPad = 16;
  const bottomPad = 28;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const maxCount = Math.max(...data.map((entry) => entry.count), 1);

  const points = data.map((entry, index) => {
    const x = leftPad + (chartWidth * index) / Math.max(1, data.length - 1);
    const y = topPad + chartHeight - (entry.count / maxCount) * chartHeight;
    return { x, y, label: entry.label, count: entry.count };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${topPad + chartHeight} L ${points[0].x} ${topPad + chartHeight} Z`;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Conversation activity line chart">
        <defs>
          <linearGradient id="conversationActivityFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={leftPad} y1={topPad + chartHeight} x2={width - rightPad} y2={topPad + chartHeight} stroke="var(--color-border)" />
        <path d={areaPath} fill="url(#conversationActivityFill)" />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="2" fill="var(--color-primary)" />
            <text x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
