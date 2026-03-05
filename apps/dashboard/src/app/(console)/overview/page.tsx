'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
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
    label: "Add at least 3 FAQs",
    description: "Publish core answers.",
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
    description: "Install the widget snippet.",
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

export default function OverviewPage() {
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!businessId || !locationSlug) {
      setSessions([]);
      setSessionsError(null);
      setSessionsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSessionsLoading(true);
    setSessionsError(null);

    const url = `/api/conversations?businessId=${encodeURIComponent(businessId)}&locationSlug=${encodeURIComponent(locationSlug)}&range=${selectedRange}`;
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
  const assistantLive = locationComplete && faqsComplete && contactComplete && widgetInstalled && assistantTested;

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

  const snippet = useMemo(() => {
    const snippetBusinessId = business.businessSlug ?? business.slug;
    const snippetLocationSlug = business.locationSlug ?? business.slug;
    return `<script async src="https://cdn.tandem.dev/widget.js" data-business="${snippetBusinessId}" data-location="${snippetLocationSlug}"></script>`;
  }, [business.businessSlug, business.locationSlug, business.slug]);

  const rangeSessionData = useMemo(() => {
    if (!sessions.length) {
      return {
        filtered: [] as ConversationSession[],
        daily: [] as Array<{ label: string; count: number }>,
        activeDays: 0,
      };
    }

    const newestTimestamp = sessions.reduce((latest, session) => {
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

    const filtered = sessions.filter((session) => {
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
  }, [selectedRange, sessions]);

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

  const knowledgeCount = enabledFaqs.length + enabledPolicies.length;
  const latestKnowledgeUpdate = [...business.faqs, ...business.policies]
    .map((item) => item.updatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const latestUpdateIso = [business.updatedAt, latestKnowledgeUpdate]
    .filter(Boolean)
    .sort((a, b) => toTimestamp(b) - toTimestamp(a))[0];

  const recentActivity = useMemo(() => {
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
      widgetIntegration?.lastSynced
        ? {
            eventKey: "widget-synced",
            label: "Widget integration synced",
            timestamp: widgetIntegration.lastSynced,
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
  }, [business.updatedAt, latestKnowledgeUpdate, sessions, widgetIntegration?.lastSynced]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const hasScope = Boolean(businessId && locationSlug);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Chatbot performance</h2>
              <p className="mt-1 text-sm text-slate-600">Metrics from Inbox sessions in the selected range.</p>
            </div>
            <select
              aria-label="Date range"
              value={selectedRange}
              onChange={(event) => updateRange(event.target.value as RangeKey)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {hasScope ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Total conversations" value={String(totalConversations)} helper={`${rangeDays(selectedRange)}-day range`} />
              <MetricTile label="Active days" value={String(rangeSessionData.activeDays)} helper="Days with at least one conversation" />
              <MetricTile label="Avg conversations / active day" value={String(avgPerActiveDay)} helper="Based on conversation created date" />
              <MetricTile label="Latest conversation" value={latestConversation} helper="Most recent conversation update" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Select a location to load conversation performance.</p>
          )}
          {sessionsLoading ? <p className="mt-3 text-xs text-slate-500">Loading conversation metrics…</p> : null}
          {sessionsError ? <p className="mt-3 text-xs text-rose-600">{sessionsError}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Website installation</h2>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Install status</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{widgetInstalled ? "Installed" : "Not detected"}</p>
            <p className="text-xs text-slate-600">
              Signal: integration where category or name includes website/widget and status is connected.
            </p>
            {widgetIntegration?.lastSynced ? (
              <p className="mt-1 text-xs text-slate-500">Last signal: {formatUtcMDY(widgetIntegration.lastSynced)}</p>
            ) : null}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Embed snippet</p>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
            <code suppressHydrationWarning>{snippet}</code>
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl bg-[var(--console-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)]"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            <Link href="/widget" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              View widget settings
            </Link>
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Preview
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {!onboardingComplete ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Onboarding</h2>
                <span className="text-xs text-slate-500">{completedCount}/{checklistState.length} complete</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">Complete these steps to launch.</p>
              <div className="mt-4 space-y-2">
                {checklistState.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                      item.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                    <span className={`ml-3 text-sm font-semibold ${item.completed ? "text-emerald-700" : "text-slate-400"}`}>
                      {item.completed ? "✓" : "→"}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Assistant health</h2>
              <p className="mt-1 text-sm text-slate-600">Current operational signals for this location.</p>
              <div className="mt-4 space-y-2">
                <HealthRow label="Knowledge coverage" value={`${enabledFaqs.length} FAQs, ${enabledPolicies.length} Policies`} href="/knowledge" />
                <HealthRow label="Handoff configured" value={liveContacts.length > 0 ? "Yes" : "No"} href="/handoff" />
                <HealthRow label="Website installed" value={widgetInstalled ? "Installed" : "Not detected"} href="/widget" />
                <HealthRow label="Last updated" value={latestUpdateIso ? formatUtcMDY(latestUpdateIso) : "—"} href="/conversations" />
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Conversation activity</h2>
              <p className="mt-1 text-sm text-slate-600">Daily conversations for the selected range.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                aria-label="Conversation activity range"
                value={selectedRange}
                onChange={(event) => updateRange(event.target.value as RangeKey)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="7d">7d</option>
                <option value="30d">30d</option>
                <option value="90d">90d</option>
              </select>
              <Link href="/conversations" className="text-sm font-semibold text-[var(--console-primary)] hover:underline">
                Open Inbox
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile label="Total conversations" value={String(totalConversations)} helper={`${rangeDays(selectedRange)}-day range`} />
            <MetricTile label="Avg conversations / day" value={String(avgPerActiveDay)} helper="Across active days" />
          </div>
          <div className="mt-4">
            <ActivityLineChart data={rangeSessionData.daily} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <p className="mt-1 text-sm text-slate-600">Latest known updates from existing dashboard data.</p>
          <div className="mt-4 space-y-2">
            {!isMounted ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Loading recent activity…
              </div>
            ) : recentActivity.length ? (
              recentActivity.map((event) => (
                <div key={event.eventKey} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{event.label}</p>
                  <p className="text-xs text-slate-500">{formatUtcMDY(event.timestamp)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No recent activity yet. Use Preview to send a test message.
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href="/conversations" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">Open Inbox</Link>
            <Link href="/knowledge" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">Update Knowledge</Link>
            <Link href="/handoff" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">Configure Handoff</Link>
            <Link href="/widget" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">Widget install</Link>
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 sm:col-span-2"
            >
              Preview
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}

function HealthRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 transition hover:border-slate-300">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </Link>
  );
}

function ActivityLineChart({ data }: { data: Array<{ label: string; count: number }> }) {
  if (!data.length) {
    return <p className="text-sm text-slate-600">No conversations available for this range.</p>;
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
            <stop offset="0%" stopColor="var(--console-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--console-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={leftPad} y1={topPad + chartHeight} x2={width - rightPad} y2={topPad + chartHeight} stroke="rgb(226 232 240)" />
        <path d={areaPath} fill="url(#conversationActivityFill)" />
        <path d={linePath} fill="none" stroke="var(--console-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="2.5" fill="var(--console-primary)" />
            <text x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="rgb(100 116 139)">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
