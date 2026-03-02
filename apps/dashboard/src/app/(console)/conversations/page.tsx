'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActiveLocation } from "@/lib/store-hooks";

const roleStyles: Record<string, string> = {
  user: "bg-[var(--console-primary-light)] text-[var(--console-primary)] border-[var(--console-primary)]",
  assistant: "bg-[var(--console-success-light)] text-[var(--console-success)] border-[var(--console-success)]",
  system: "bg-[var(--console-bg-hover)] text-[var(--console-text-secondary)] border-[var(--console-border)]",
};

const roleLabels: Record<string, string> = {
  user: "Customer",
  assistant: "Assistant",
  system: "System",
};

type ConversationSession = {
  id: string;
  locationId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export default function ConversationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeLocation = useActiveLocation();

  const sessionIdFromUrl = searchParams.get("sessionId")?.trim();

  const locationId = activeLocation?.locationSlug ?? activeLocation?.slug;

  useEffect(() => {
    if (!locationId) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (next.get("locationId") !== locationId) {
      next.set("locationId", locationId);
      changed = true;
    }

    if (changed) {
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [locationId, pathname, router, searchParams]);

  const selectedLocationLabel = useMemo(() => {
    return activeLocation?.locationName ?? activeLocation?.location ?? "Select a location";
  }, [activeLocation]);

  const onSessionChange = useCallback((nextSessionId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (locationId) {
      next.set("locationId", locationId);
    }
    next.set("sessionId", nextSessionId);
    router.replace(`${pathname}?${next.toString()}`);
  }, [locationId, pathname, router, searchParams]);

  if (!activeLocation || !locationId) {
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">Conversations</p>
          <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Conversations</h1>
          <p className="text-sm text-[var(--console-text-tertiary)]">Review chat sessions, search threads, and monitor escalations by location.</p>
        </div>
        <div className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-2 text-sm text-[var(--console-text-secondary)] shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">Location</p>
          <p className="font-semibold text-[var(--console-text-primary)]">{selectedLocationLabel}</p>
        </div>
      </header>

      <section className="grid gap-3 rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <label className="flex flex-col gap-2 text-sm text-[var(--console-text-secondary)]">
          <span className="font-semibold text-[var(--console-text-primary)]">Search conversations</span>
          <input
            type="search"
            placeholder="Search by session title"
            className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-2.5 text-sm text-[var(--console-text-primary)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--console-text-secondary)]">
          <span className="font-semibold text-[var(--console-text-primary)]">Filter</span>
          <select className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-2.5 text-sm text-[var(--console-text-primary)]">
            <option value="all">All sessions</option>
            <option value="handoff">Handoff sessions</option>
            <option value="assistant">Assistant-only sessions</option>
          </select>
        </label>
      </section>

      {locationId ? (
        <ConversationsWorkspace
          key={locationId}
          locationId={locationId}
          selectedLocationLabel={selectedLocationLabel}
          selectedSessionIdFromUrl={sessionIdFromUrl}
          onSessionChange={onSessionChange}
        />
      ) : null}
    </div>
  );
}

function ConversationsWorkspace({
  locationId,
  selectedLocationLabel,
  selectedSessionIdFromUrl,
  onSessionChange,
}: {
  locationId: string;
  selectedLocationLabel: string;
  selectedSessionIdFromUrl?: string;
  onSessionChange: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(selectedSessionIdFromUrl);

  useEffect(() => {
    setSelectedSessionId(selectedSessionIdFromUrl);
  }, [selectedSessionIdFromUrl]);

  useEffect(() => {
    let cancelled = false;

    setSessionsLoading(true);
    setSessionError(null);

    fetch(`/api/conversations?locationId=${encodeURIComponent(locationId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error ?? 'Failed to load sessions');
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const nextSessions = payload.sessions ?? [];
        setSessions(nextSessions);

        const nextFromUrl = selectedSessionIdFromUrl;
        const nextSessionId =
          nextFromUrl && nextSessions.some((session: ConversationSession) => session.id === nextFromUrl)
            ? nextFromUrl
            : nextSessions?.[0]?.id;

        setSelectedSessionId(nextSessionId);
        if (nextSessionId && nextSessionId !== nextFromUrl) {
          onSessionChange(nextSessionId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSessionError(error instanceof Error ? error.message : 'Unable to load conversations');
          setSessions([]);
          setSelectedSessionId(undefined);
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
  }, [locationId, onSessionChange, selectedSessionIdFromUrl]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--console-text-primary)]">Recent sessions</p>
          <span className="text-xs text-[var(--console-text-tertiary)]">{selectedLocationLabel}</span>
        </div>
        {sessionError ? (
          <p className="mt-4 rounded-2xl bg-[var(--console-warning-light)] px-3 py-2 text-sm text-[var(--console-warning)]">{sessionError}</p>
        ) : null}
        {sessionsLoading ? (
          <p className="mt-4 text-sm text-[var(--console-text-tertiary)]">Loading sessions…</p>
        ) : sessions.length ? (
          <ul className="mt-4 space-y-2">
            {sessions.map((session) => {
              const isActive = selectedSessionId === session.id;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      onSessionChange(session.id);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[var(--console-primary)] bg-[var(--console-primary-light)] text-[var(--console-primary)]'
                        : 'border-[var(--console-border)] bg-[var(--console-bg-card)] text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {session.title?.trim() || `Session ${session.id.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-[var(--console-text-tertiary)]">
                      Updated {formatTimestamp(session.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--console-border)] px-3 py-4 text-sm text-[var(--console-text-tertiary)]">
            No sessions for this location yet.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 shadow-sm">
        {selectedSessionId ? (
          <ConversationMessages key={selectedSessionId} selectedSessionId={selectedSessionId} />
        ) : (
          <p className="text-sm text-[var(--console-text-tertiary)]">Select a session to view the thread.</p>
        )}
      </section>
    </div>
  );
}

function ConversationMessages({ selectedSessionId }: { selectedSessionId: string }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/conversations/${selectedSessionId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error ?? 'Failed to load messages');
        }
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setMessages(payload.messages ?? []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageError(error instanceof Error ? error.message : 'Unable to load messages');
          setMessages([]);
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
  }, [selectedSessionId]);

  return (
    <>
      {messageError ? (
        <p className="rounded-2xl bg-[var(--console-warning-light)] px-3 py-2 text-sm text-[var(--console-warning)]">{messageError}</p>
      ) : null}
      {messagesLoading ? (
        <p className="text-sm text-[var(--console-text-tertiary)]">Loading conversation…</p>
      ) : messages.length ? (
        <ul className="space-y-4">
          {messages.map((message) => {
            const badgeStyle = roleStyles[message.role] ?? roleStyles.system;
            return (
              <li key={message.id} className="rounded-2xl border border-[var(--console-border-light)] bg-[var(--console-bg-hover)] p-4">
                <div className="flex items-center justify-between text-xs text-[var(--console-text-tertiary)]">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeStyle}`}>
                    {roleLabels[message.role] ?? message.role}
                  </span>
                  <span>{formatTimestamp(message.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-[var(--console-text-primary)]">{message.content}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--console-text-tertiary)]">No messages captured for this session.</p>
      )}
    </>
  );
}

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
