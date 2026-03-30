'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveChatScope } from "@/lib/chat-scope";
import { useActiveLocation } from "@/lib/store-hooks";

type FilterKey = "all" | "open" | "escalated" | "resolved";

type ConversationSession = {
  id: string;
  businessId: string;
  locationSlug?: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string | null;
  isUnread?: boolean;
  status?: string | null;
};

type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(s: ConversationSession) {
  if (s.status === "escalated") return "escalated";
  if (s.status === "resolved") return "resolved";
  if (s.isUnread) return "open";
  return "open";
}

function ConversationsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = useActiveLocation();
  const scope = useMemo(() => resolveChatScope(location), [location]);
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const sessionId = searchParams.get("sessionId")?.trim() ?? null;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!scope.businessId || !scope.locationSlug) return;
    let dead = false;
    setSessionsLoading(true);
    setSessions([]);
    fetch(`/api/conversations?businessId=${encodeURIComponent(scope.businessId)}&locationSlug=${encodeURIComponent(scope.locationSlug)}&range=30d`)
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((d) => { if (!dead) setSessions(Array.isArray(d.sessions) ? d.sessions : []); })
      .catch(() => { if (!dead) setSessions([]); })
      .finally(() => { if (!dead) setSessionsLoading(false); });
    return () => { dead = true; };
  }, [scope.businessId, scope.locationSlug]);

  useEffect(() => {
    if (!sessionId) { setMessages([]); return; }
    let dead = false;
    setMessagesLoading(true);
    setMessages([]);
    fetch(`/api/conversations/${sessionId}`)
      .then((r) => r.ok ? r.json() : { messages: [] })
      .then((d) => { if (!dead) setMessages(Array.isArray(d.messages) ? d.messages : []); })
      .catch(() => { if (!dead) setMessages([]); })
      .finally(() => { if (!dead) setMessagesLoading(false); });
    return () => { dead = true; };
  }, [sessionId]);

  const selectSession = useCallback((id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (scope.businessId) next.set("businessId", scope.businessId);
    if (scope.locationSlug) next.set("locationSlug", scope.locationSlug);
    next.set("sessionId", id);
    router.replace(`${pathname}?${next.toString()}`);
  }, [scope, pathname, router, searchParams]);

  if (!location || !scope.businessId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-[var(--color-text)]">Select a location</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Choose a location from the switcher above to view its conversations.</p>
        </div>
      </div>
    );
  }

  const total = sessions.length;
  const escalated = sessions.filter((s) => s.status === "escalated").length;
  const open = sessions.filter((s) => !s.status || s.status === "open" || s.isUnread).length;
  const resolved = sessions.filter((s) => s.status === "resolved").length;

  const filtered = filter === "all" ? sessions
    : filter === "escalated" ? sessions.filter((s) => s.status === "escalated")
    : filter === "resolved" ? sessions.filter((s) => s.status === "resolved")
    : sessions.filter((s) => !s.status || s.status === "open" || s.isUnread);

  const sorted = [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const selectedSession = sessions.find((s) => s.id === sessionId) ?? null;

  const FILTERS: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: total },
    { key: "open", label: "Open", count: open },
    { key: "escalated", label: "Escalated", count: escalated },
    { key: "resolved", label: "Resolved", count: resolved },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header + stats */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Conversations</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">All customer chats for this location · last 30 days</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: total },
          { label: "Open", value: open, warn: open > 0 },
          { label: "Escalated", value: escalated, warn: escalated > 0 },
          { label: "Resolved", value: resolved, ok: resolved > 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${stat.warn ? "text-orange-600" : stat.ok ? "text-emerald-600" : "text-[var(--color-text)]"}`}>
              {sessionsLoading ? "…" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${filter === f.key ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === f.key ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-4 overflow-hidden" style={{ minHeight: "400px" }}>
        {/* Session list */}
        <div className="w-80 shrink-0 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[var(--color-text-secondary)]">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">No conversations {filter !== "all" ? `in "${filter}"` : "yet"}.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {sorted.map((session) => {
                const isActive = session.id === sessionId;
                const sl = statusLabel(session);
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => selectSession(session.id)}
                      className={`w-full px-4 py-3.5 text-left transition-colors ${isActive ? "bg-[var(--color-primary-light)]" : "hover:bg-[var(--color-surface-hover)]"}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isActive ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"}`}>
                          {(session.title ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`truncate text-sm font-medium ${isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>{session.title ?? "Untitled"}</p>
                            {sl === "escalated" && <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">Escalated</span>}
                            {sl === "resolved" && <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Resolved</span>}
                            {sl === "open" && session.isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />}
                          </div>
                          {session.lastMessageSnippet && (
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{session.lastMessageSnippet}</p>
                          )}
                          <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">{relativeTime(session.updatedAt)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Thread detail */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {!selectedSession ? (
            <div className="flex flex-1 items-center justify-center text-center px-8">
              <div>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)]">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--color-text)]">Select a conversation</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Click any conversation in the list to view the full thread.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
                <div>
                  <p className="font-semibold text-[var(--color-text)]">{selectedSession.title ?? "Untitled"}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Started {formatTimestamp(selectedSession.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSession.status !== "resolved" && (
                    <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                      Mark resolved
                    </button>
                  )}
                  {selectedSession.status !== "escalated" && (
                    <button type="button" className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors">
                      Mark escalated
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {messagesLoading ? (
                  <p className="text-center text-sm text-[var(--color-text-secondary)]">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--color-text-secondary)]">No messages in this conversation.</p>
                ) : (
                  <ul className="space-y-4">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user";
                      const isSystem = msg.role === "system";
                      return (
                        <li key={msg.id} className={`flex ${isUser ? "justify-end" : isSystem ? "justify-center" : "justify-start"}`}>
                          {isSystem ? (
                            <div className="max-w-[80%] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-center text-xs text-[var(--color-text-secondary)]">
                              {msg.content}
                            </div>
                          ) : (
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isUser ? "rounded-tr-sm bg-[var(--color-primary)] text-white" : "rounded-tl-sm bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]"}`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <p className={`mt-1 text-[10px] ${isUser ? "text-white/60" : "text-[var(--color-text-secondary)]"}`}>{formatTimestamp(msg.createdAt)}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div />}>
      <ConversationsClient />
    </Suspense>
  );
}
