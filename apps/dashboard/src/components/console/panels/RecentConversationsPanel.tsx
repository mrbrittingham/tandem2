"use client";

import Link from "next/link";

type ConversationSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string | null;
  isUnread?: boolean;
  status?: string | null;
};

type Props = {
  sessions: ConversationSession[];
  loading: boolean;
  businessId?: string;
  locationSlug?: string;
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

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
      <div className="h-7 w-7 rounded-full bg-[var(--color-border)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
        <div className="h-2.5 w-3/4 rounded bg-[var(--color-border)]" />
      </div>
      <div className="h-2.5 w-10 rounded bg-[var(--color-border)]" />
    </div>
  );
}

export function RecentConversationsPanel({ sessions, loading, businessId, locationSlug }: Props) {
  const recent = [...sessions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent Conversations</h2>
        <Link
          href="/conversations"
          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : recent.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--color-text)]">No conversations yet</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Install the chat widget to start getting conversations.
          </p>
          <Link
            href="/widget"
            className="mt-3 inline-flex items-center rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
          >
            Get install snippet →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {recent.map((s) => (
            <li key={s.id}>
              <Link
                href={`/conversations?sessionId=${s.id}&businessId=${businessId ?? ""}&locationSlug=${locationSlug ?? ""}`}
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[11px] font-bold text-[var(--color-primary)]">
                  {(s.title ?? "?")[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">
                      {s.title ?? "Untitled"}
                    </p>
                    {s.status === "escalated" && (
                      <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                        Escalated
                      </span>
                    )}
                    {s.status === "resolved" && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Resolved
                      </span>
                    )}
                    {(!s.status || s.status === "open") && s.isUnread && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </div>
                  {s.lastMessageSnippet && (
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                      {s.lastMessageSnippet}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-[var(--color-text-secondary)]">
                  {relativeTime(s.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
