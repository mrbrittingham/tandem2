'use client';

import { useEffect, useMemo, useState } from "react";
import { useBusinesses } from "@/lib/store-hooks";

const roleStyles: Record<string, string> = {
  user: "bg-blue-50 text-blue-700 border-blue-100",
  assistant: "bg-emerald-50 text-emerald-700 border-emerald-100",
  system: "bg-slate-100 text-slate-700 border-slate-200",
};

const roleLabels: Record<string, string> = {
  user: "Customer",
  assistant: "Assistant",
  system: "System",
};

type ConversationSession = {
  id: string;
  businessId: string;
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
  const businesses = useBusinesses();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | undefined>();
  const businessId = selectedBusinessId ?? businesses[0]?.slug;

  const selectedBusinessLabel = useMemo(() => {
    return businesses.find((biz) => biz.slug === businessId)?.name ?? 'Select a business';
  }, [businessId, businesses]);

  if (!businesses.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-slate-500">
        Add a business to start capturing live conversations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Inbox</p>
          <h1 className="text-3xl font-semibold text-slate-900">Conversations</h1>
          <p className="text-sm text-slate-500">Monitor live chats and handoffs across every business.</p>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Business</span>
          <select
            value={businessId}
            onChange={(event) => setSelectedBusinessId(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.slug}>
                {business.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {businessId ? (
        <ConversationsWorkspace
          key={businessId}
          businessId={businessId}
          selectedBusinessLabel={selectedBusinessLabel}
        />
      ) : null}
    </div>
  );
}

function ConversationsWorkspace({
  businessId,
  selectedBusinessLabel,
}: {
  businessId: string;
  selectedBusinessLabel: string;
}) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/conversations?businessId=${encodeURIComponent(businessId)}`)
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
        setSessions(payload.sessions ?? []);
        setSelectedSessionId(payload.sessions?.[0]?.id);
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
  }, [businessId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Recent sessions</p>
          <span className="text-xs text-slate-500">{selectedBusinessLabel}</span>
        </div>
        {sessionError ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{sessionError}</p>
        ) : null}
        {sessionsLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading sessions…</p>
        ) : sessions.length ? (
          <ul className="mt-4 space-y-2">
            {sessions.map((session) => {
              const isActive = selectedSessionId === session.id;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {session.title?.trim() || `Session ${session.id.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated {formatTimestamp(session.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            No sessions for this business yet.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {selectedSessionId ? (
          <ConversationMessages key={selectedSessionId} selectedSessionId={selectedSessionId} />
        ) : (
          <p className="text-sm text-slate-500">Select a session to view the thread.</p>
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
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{messageError}</p>
      ) : null}
      {messagesLoading ? (
        <p className="text-sm text-slate-500">Loading conversation…</p>
      ) : messages.length ? (
        <ul className="space-y-4">
          {messages.map((message) => {
            const badgeStyle = roleStyles[message.role] ?? roleStyles.system;
            return (
              <li key={message.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeStyle}`}>
                    {roleLabels[message.role] ?? message.role}
                  </span>
                  <span>{formatTimestamp(message.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{message.content}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No messages captured for this session.</p>
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
