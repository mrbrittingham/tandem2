'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveChatScope, resolveLocationLabel } from "@/lib/chat-scope";
import { useActiveLocation } from "@/lib/store-hooks";

const roleStyles: Record<string, string> = {
  user: "bg-[var(--console-primary-light)] text-[var(--console-primary)] border-[var(--console-primary)]",
  assistant: "bg-[var(--console-success-light)] text-[var(--console-success)] border-[var(--console-success)]",
  system: "bg-[var(--console-bg-hover)] text-[var(--console-text-secondary)] border-[var(--console-border)]",
};

const roleBubbleStyles: Record<string, string> = {
  user: "ml-auto bg-[var(--console-primary)] text-white",
  assistant: "mr-auto bg-[var(--console-bg-hover)] text-[var(--console-text-primary)]",
  system: "mx-auto bg-[var(--console-bg-card)] border border-[var(--console-border)] text-[var(--console-text-secondary)]",
};

const roleLabels: Record<string, string> = {
  user: "Customer",
  assistant: "Assistant",
  system: "System",
};

type ConversationFilter = "all" | "unread" | "escalated" | "resolved";

type ConversationSession = {
  id: string;
  businessId: string;
  locationSlug?: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string | null;
  unreadCount?: number;
  isUnread?: boolean;
  status?: string | null;
};

type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  title: string | null;
  updatedAt: string;
};

function ConversationsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeLocation = useActiveLocation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const sessionIdFromUrl = searchParams.get("sessionId")?.trim();
  const queryFromUrl = searchParams.get("query")?.trim() ?? "";
  const scope = useMemo(() => resolveChatScope(activeLocation), [activeLocation]);
  const businessId = scope.businessId;
  const locationSlug = scope.locationSlug;

  useEffect(() => {
    if (!businessId || !locationSlug) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (next.get("businessId") !== businessId) {
      next.set("businessId", businessId);
      changed = true;
    }

    if (next.get("locationSlug") !== locationSlug) {
      next.set("locationSlug", locationSlug);
      changed = true;
    }

    if (changed) {
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [businessId, locationSlug, pathname, router, searchParams]);

  const selectedLocationLabel = useMemo(() => {
    if (!isMounted) {
      return "…";
    }
    return resolveLocationLabel(activeLocation);
  }, [activeLocation, isMounted]);

  const onSessionChange = useCallback((nextSessionId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (businessId) {
      next.set("businessId", businessId);
    }
    if (locationSlug) {
      next.set("locationSlug", locationSlug);
    }
    next.set("sessionId", nextSessionId);
    router.replace(`${pathname}?${next.toString()}`);
  }, [businessId, locationSlug, pathname, router, searchParams]);

  if (!activeLocation || !businessId || !locationSlug) {
    return (
      <section className="rounded-3xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-card)] p-8 text-[var(--console-text-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--console-text-primary)]">Select a location</h2>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">
          Pick or create a location from the header switcher to review conversations.
        </p>
      </section>
    );
  }

  return (
    <ConversationsWorkspace
      key={`${businessId}:${locationSlug}`}
      businessId={businessId}
      locationSlug={locationSlug}
      selectedLocationLabel={selectedLocationLabel}
      selectedSessionIdFromUrl={sessionIdFromUrl}
      initialQuery={queryFromUrl}
      onSessionChange={onSessionChange}
    />
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div />}>
      <ConversationsPageClient />
    </Suspense>
  );
}

function ConversationsWorkspace({
  businessId,
  locationSlug,
  selectedLocationLabel,
  selectedSessionIdFromUrl,
  initialQuery,
  onSessionChange,
}: {
  businessId: string;
  locationSlug: string;
  selectedLocationLabel: string;
  selectedSessionIdFromUrl?: string;
  initialQuery: string;
  onSessionChange: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(selectedSessionIdFromUrl);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [filterValue, setFilterValue] = useState<ConversationFilter>("all");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSelectedSessionId(selectedSessionIdFromUrl);
    if (selectedSessionIdFromUrl) {
      setMobileView("detail");
    }
  }, [selectedSessionIdFromUrl]);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;

    setSessionsLoading(true);
    setSessionError(null);

    fetch(`/api/conversations?businessId=${encodeURIComponent(businessId)}&locationSlug=${encodeURIComponent(locationSlug)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error ?? "Failed to load sessions");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const nextSessions = (payload.sessions ?? []) as ConversationSession[];
        setSessions(nextSessions);

        const nextFromUrl = selectedSessionIdFromUrl;
        const nextSessionId =
          nextFromUrl && nextSessions.some((session) => session.id === nextFromUrl)
            ? nextFromUrl
            : nextSessions[0]?.id;

        setSelectedSessionId(nextSessionId);
        if (nextSessionId && nextSessionId !== nextFromUrl) {
          onSessionChange(nextSessionId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSessionError(error instanceof Error ? error.message : "Unable to load conversations");
          setSessions([]);
          setSelectedSessionId(undefined);
          setMobileView("list");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, locationSlug, onSessionChange, selectedSessionIdFromUrl]);

  const hasUnreadData = useMemo(
    () => sessions.some((session) => typeof session.unreadCount === "number" || typeof session.isUnread === "boolean"),
    [sessions],
  );
  const hasStatusData = useMemo(
    () => sessions.some((session) => typeof session.status === "string" && session.status.trim().length > 0),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return sessions.filter((session) => {
      const title = session.title?.trim() || "Website chat";
      const snippet = (session.lastMessageSnippet?.trim() || "No recent message").toLowerCase();
      const matchesSearch = !query || title.toLowerCase().includes(query) || snippet.includes(query);
      if (!matchesSearch) {
        return false;
      }

      if (filterValue === "unread") {
        if (!hasUnreadData) {
          return true;
        }
        const unreadCount = typeof session.unreadCount === "number" ? session.unreadCount : 0;
        return unreadCount > 0 || session.isUnread === true;
      }

      if (filterValue === "escalated") {
        if (!hasStatusData) {
          return true;
        }
        return (session.status ?? "").toLowerCase() === "escalated";
      }

      if (filterValue === "resolved") {
        if (!hasStatusData) {
          return true;
        }
        return (session.status ?? "").toLowerCase() === "resolved";
      }

      return true;
    });
  }, [filterValue, hasStatusData, hasUnreadData, searchValue, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [selectedSessionId, sessions],
  );

  const analytics = useMemo(() => {
    const newestSessionTimestamp = sessions.reduce((latest, session) => {
      const timestamp = new Date(session.createdAt).getTime();
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      return Math.max(latest, timestamp);
    }, 0);

    const sevenDaysAgo = newestSessionTimestamp > 0
      ? newestSessionTimestamp - 7 * 24 * 60 * 60 * 1000
      : 0;

    const totalLast7Days = sessions.filter((session) => {
      const timestamp = new Date(session.createdAt).getTime();
      return !Number.isNaN(timestamp) && timestamp >= sevenDaysAgo;
    }).length;

    const sessionsWithStatus = sessions.filter(
      (session) => typeof session.status === "string" && session.status.trim().length > 0,
    );

    const resolvedCount = sessionsWithStatus.filter(
      (session) => (session.status ?? "").trim().toLowerCase() === "resolved",
    ).length;

    const escalatedCount = sessionsWithStatus.filter(
      (session) => (session.status ?? "").trim().toLowerCase() === "escalated",
    ).length;

    const openCount = sessionsWithStatus.filter(
      (session) => (session.status ?? "").trim().toLowerCase() !== "resolved",
    ).length;

    const resolutionRate = sessionsWithStatus.length
      ? `${Math.round((resolvedCount / sessionsWithStatus.length) * 100)}%`
      : "—";

    return {
      totalLast7Days,
      openCount,
      escalatedCount,
      resolutionRate,
      hasStatusData: sessionsWithStatus.length > 0,
    };
  }, [sessions]);

  const conversationSeries = useMemo(() => {
    if (!sessions.length) {
      return [] as Array<{ label: string; count: number }>;
    }

    const newestTimestamp = sessions.reduce((latest, session) => {
      const timestamp = new Date(session.createdAt).getTime();
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      return Math.max(latest, timestamp);
    }, 0);

    if (newestTimestamp <= 0) {
      return [] as Array<{ label: string; count: number }>;
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    const start = newestTimestamp - 6 * oneDayMs;

    const buckets = new Map<string, number>();
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(start + index * oneDayMs);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }

    for (const session of sessions) {
      const timestamp = new Date(session.createdAt).getTime();
      if (Number.isNaN(timestamp) || timestamp < start) {
        continue;
      }
      const key = new Date(timestamp).toISOString().slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    return Array.from(buckets.entries()).map(([key, count]) => ({
      label: key.slice(5).replace("-", "/"),
      count,
    }));
  }, [sessions]);

  const activitySeries = useMemo(() => {
    if (!sessions.length) {
      return [] as number[];
    }

    const sorted = [...sessions]
      .map((session) => new Date(session.updatedAt).getTime())
      .filter((timestamp) => !Number.isNaN(timestamp))
      .sort((a, b) => a - b);

    if (!sorted.length) {
      return [] as number[];
    }

    const newest = sorted[sorted.length - 1];
    const oldest = sorted[0];
    const span = Math.max(1, newest - oldest);
    const bucketCount = 12;
    const buckets = Array.from({ length: bucketCount }, () => 0);

    for (const timestamp of sorted) {
      const ratio = (timestamp - oldest) / span;
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * (bucketCount - 1))));
      buckets[index] += 1;
    }

    return buckets;
  }, [sessions]);

  const showListPanel = mobileView === "list";
  const showDetailPanel = mobileView === "detail";

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Conversations"
          value={analytics.totalLast7Days.toLocaleString()}
          subtext="Last 7 days"
        />
        <MetricCard
          label="Open Conversations"
          value={analytics.hasStatusData ? analytics.openCount.toLocaleString() : "—"}
          subtext={analytics.hasStatusData ? "Status not resolved" : "Status data unavailable"}
        />
        <MetricCard
          label="Escalated"
          value={analytics.hasStatusData ? analytics.escalatedCount.toLocaleString() : "—"}
          subtext={analytics.hasStatusData ? "Marked escalated" : "Status data unavailable"}
        />
        <MetricCard
          label="Avg Response Time"
          value="—"
          subtext="TODO: derive from assistant reply deltas"
        />
        <MetricCard
          label="Resolution Rate"
          value={resolutionRateDisplay(analytics.resolutionRate)}
          subtext={analytics.hasStatusData ? "Resolved sessions" : "Status data unavailable"}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Conversations Over Time" subtitle="Daily counts · last 7 days">
          <MiniBarChart data={conversationSeries} />
        </ChartCard>
        <ChartCard title="Recent Activity" subtitle="Session updates trend">
          <MiniSparkline data={activitySeries} />
        </ChartCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <section className={`${showListPanel ? "block" : "hidden"} rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] shadow-sm lg:block`}>
        <div className="border-b border-[var(--console-border-light)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold text-[var(--console-text-primary)]">Chats</p>
            <span className="text-xs text-[var(--console-text-tertiary)]">{filteredSessions.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search inbox"
              className="w-full rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)]"
            />
            <select
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value as ConversationFilter)}
              className="w-full rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-3 py-2 text-sm text-[var(--console-text-primary)]"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
          {sessionError ? (
            <p className="rounded-2xl bg-[var(--console-warning-light)] px-3 py-2 text-sm text-[var(--console-warning)]">{sessionError}</p>
          ) : null}

          {sessionsLoading ? (
            <p className="px-2 py-3 text-sm text-[var(--console-text-tertiary)]">Loading conversations…</p>
          ) : filteredSessions.length ? (
            <ul className="space-y-1.5">
              {filteredSessions.map((session) => {
                const isActive = selectedSessionId === session.id;
                const title = session.title?.trim() || "Website chat";
                const snippet = session.lastMessageSnippet?.trim() || session.title?.trim() || "No recent message";
                const status = session.status?.trim();
                const unreadCount = typeof session.unreadCount === "number" ? session.unreadCount : 0;
                const hasUnread = unreadCount > 0 || session.isUnread === true;

                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        onSessionChange(session.id);
                        setMobileView("detail");
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        isActive
                          ? "border-[var(--console-primary)] bg-[var(--console-primary-light)]"
                          : "border-transparent hover:border-[var(--console-border)] hover:bg-[var(--console-bg-hover)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-[var(--console-text-primary)]">{title}</p>
                        <span className="shrink-0 text-[11px] text-[var(--console-text-tertiary)]">{formatTimestamp(session.updatedAt, isMounted)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {hasUnread ? <span className="h-2 w-2 rounded-full bg-[var(--console-primary)]" aria-label="Unread" /> : null}
                        <p className="line-clamp-1 text-xs text-[var(--console-text-secondary)]">{snippet}</p>
                      </div>
                      {status ? (
                        <span className="mt-2 inline-flex rounded-full border border-[var(--console-border)] bg-[var(--console-bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--console-text-tertiary)]">
                          {status}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-[var(--console-text-tertiary)]">No conversations match your search.</p>
          )}
        </div>
      </section>

      <section className={`${showDetailPanel ? "block" : "hidden"} min-h-[420px] rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] shadow-sm lg:block`}>
        {selectedSessionId ? (
          <ConversationDetail
            key={selectedSessionId}
            selectedSessionId={selectedSessionId}
            businessId={businessId}
            locationSlug={locationSlug}
            selectedLocationLabel={selectedLocationLabel}
            selectedSession={selectedSession}
            isMounted={isMounted}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <div className="p-6 text-sm text-[var(--console-text-tertiary)]">Select a conversation to view the thread.</div>
        )}
      </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <article className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-tertiary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight text-[var(--console-text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--console-text-tertiary)]">{subtext}</p>
    </article>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-tertiary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--console-text-tertiary)]">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function MiniBarChart({ data }: { data: Array<{ label: string; count: number }> }) {
  if (!data.length) {
    return <p className="text-xs text-[var(--console-text-tertiary)]">No data</p>;
  }

  const maxCount = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex h-24 items-end gap-2">
        {data.map((entry) => (
          <div key={entry.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-md bg-[var(--console-primary)]/80"
              style={{ height: `${Math.max(6, Math.round((entry.count / maxCount) * 100))}%` }}
              title={`${entry.label}: ${entry.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((entry) => (
          <span key={`${entry.label}-label`} className="flex-1 text-center text-[10px] text-[var(--console-text-tertiary)]">
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data.length) {
    return <p className="text-xs text-[var(--console-text-tertiary)]">No data</p>;
  }

  const width = 280;
  const height = 90;
  const maxValue = Math.max(...data, 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / maxValue) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Recent activity trend">
      <polyline
        fill="none"
        stroke="var(--console-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function resolutionRateDisplay(value: string) {
  return value || "—";
}

function ConversationDetail({
  selectedSessionId,
  businessId,
  locationSlug,
  selectedLocationLabel,
  selectedSession,
  isMounted,
  onBack,
}: {
  selectedSessionId: string;
  businessId: string;
  locationSlug: string;
  selectedLocationLabel: string;
  selectedSession?: ConversationSession;
  isMounted: boolean;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionMeta, setSessionMeta] = useState<ConversationDetail | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessagesLoading(true);
    setMessageError(null);

    fetch(`/api/conversations/${selectedSessionId}?businessId=${encodeURIComponent(businessId)}&locationSlug=${encodeURIComponent(locationSlug)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error ?? "Failed to load messages");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setMessages(payload.messages ?? []);
        setSessionMeta(payload.session ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageError(error instanceof Error ? error.message : "Unable to load messages");
          setMessages([]);
          setSessionMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, locationSlug, selectedSessionId]);

  const title = sessionMeta?.title?.trim() || selectedSession?.title?.trim() || "Website chat";
  const updatedAt = sessionMeta?.updatedAt ?? selectedSession?.updatedAt;

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--console-border-light)] bg-[var(--console-bg-card)] px-4 py-3">
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[var(--console-border)] px-2 py-1 text-xs font-semibold text-[var(--console-text-secondary)]"
          >
            Back
          </button>
        </div>
        <h2 className="mt-1 text-base font-semibold text-[var(--console-text-primary)]">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--console-text-tertiary)]">
          {isMounted ? selectedLocationLabel : "…"}
          {updatedAt ? ` · Updated ${formatTimestamp(updatedAt, isMounted)}` : ""}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messageError ? (
          <p className="rounded-2xl bg-[var(--console-warning-light)] px-3 py-2 text-sm text-[var(--console-warning)]">{messageError}</p>
        ) : null}

        {messagesLoading ? (
          <p className="text-sm text-[var(--console-text-tertiary)]">Loading conversation…</p>
        ) : messages.length ? (
          <ul className="space-y-3">
            {messages.map((message) => {
              const badgeStyle = roleStyles[message.role] ?? roleStyles.system;
              const bubbleStyle = roleBubbleStyles[message.role] ?? roleBubbleStyles.system;
              return (
                <li key={message.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--console-text-tertiary)]">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${badgeStyle}`}>
                      {roleLabels[message.role] ?? message.role}
                    </span>
                    <span>{formatTimestamp(message.createdAt, isMounted)}</span>
                  </div>
                  <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${bubbleStyle}`}>
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--console-text-tertiary)]">No messages captured for this session.</p>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(value: string, isMounted = true) {
  if (!isMounted) {
    return "…";
  }

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
