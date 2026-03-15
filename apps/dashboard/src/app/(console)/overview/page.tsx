'use client';

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveLocation, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { resolveChatScope } from "@/lib/chat-scope";

type RangeKey = "7d" | "30d" | "90d";

type ConversationSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string | null;
  isUnread?: boolean;
  status?: string | null;
};

function parseRange(v: string | null): RangeKey {
  if (v === "7d" || v === "30d" || v === "90d") return v;
  return "30d";
}

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

function ActivityChart({ sessions }: { sessions: ConversationSession[] }) {
  const buckets = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(`${d.getMonth() + 1}/${d.getDate()}`, 0);
    }
    for (const s of sessions) {
      const d = new Date(s.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  }, [sessions]);

  if (buckets.every((b) => b.count === 0)) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        No activity yet — conversations will appear here.
      </div>
    );
  }

  const W = 640, H = 200, lp = 8, rp = 8, tp = 16, bp = 28;
  const cw = W - lp - rp, ch = H - tp - bp;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const pts = buckets.map((b, i) => ({
    x: lp + (cw * i) / Math.max(1, buckets.length - 1),
    y: tp + ch - (b.count / max) * ch,
    ...b,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${tp + ch} L ${pts[0].x} ${tp + ch} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
      <defs>
        <linearGradient id="og" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={lp} y1={tp + ch} x2={W - rp} y2={tp + ch} stroke="var(--color-border)" strokeWidth="1" />
      <path d={area} fill="url(#og)" />
      <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.filter((_, i) => i % 2 === 0).map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--color-primary)" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--color-text-secondary)">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function StatCard({ label, value, tone = "default", sub }: {
  label: string; value: string | number; tone?: "default" | "warn" | "ok"; sub?: string;
}) {
  const vc = tone === "warn" ? "text-orange-600" : tone === "ok" ? "text-emerald-600" : "text-[var(--color-text)]";
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${vc}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{sub}</p>}
    </div>
  );
}

function SetupChecklist({ business }: { business: NonNullable<ReturnType<typeof useActiveLocation>> }) {
  const steps = [
    {
      key: "menu",
      label: "Import your menu",
      desc: "Add items from your website or enter manually.",
      href: "/menus",
      done: false,
    },
    {
      key: "knowledge",
      label: "Add Q&A knowledge",
      desc: "Add at least 3 common questions.",
      href: "/knowledge",
      done: (business.faqs?.length ?? 0) >= 3,
    },
    {
      key: "handoff",
      label: "Configure live handoff",
      desc: "Set how customers reach a real person.",
      href: "/handoff",
      done: (business.handoff?.contactMethods ?? []).some((c) => c.enabled),
    },
    {
      key: "widget",
      label: "Install the chat widget",
      desc: "Copy the snippet to your website.",
      href: "/widget",
      done: false,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Setup progress</h2>
        <span className="text-sm font-bold text-[var(--color-primary)]">{pct}%</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-3.5">
        {steps.map((step) => (
          <li key={step.key}>
            <Link href={step.href} className="group flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${step.done ? "border-emerald-500 bg-emerald-500" : "border-[var(--color-border)] group-hover:border-[var(--color-primary)]"}`}>
                {step.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-5" />
                  </svg>
                )}
              </span>
              <div>
                <p className={`text-sm font-medium leading-tight ${step.done ? "text-[var(--color-text-secondary)] line-through" : "text-[var(--color-text)] group-hover:text-[var(--color-primary)]"}`}>
                  {step.label}
                </p>
                {!step.done && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{step.desc}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openCreateLocation } = useConsoleDialogs();
  const { open: openPreview } = usePreviewDock();
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const location = useActiveLocation();
  const scope = useMemo(() => resolveChatScope(location), [location]);
  const range = parseRange(searchParams.get("range"));
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scope.businessId || !scope.locationSlug) return;
    let dead = false;
    setLoading(true);
    setSessions([]);
    fetch(`/api/conversations?businessId=${encodeURIComponent(scope.businessId)}&locationSlug=${encodeURIComponent(scope.locationSlug)}&range=${range}`)
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((d) => { if (!dead) setSessions(Array.isArray(d.sessions) ? d.sessions : []); })
      .catch(() => { if (!dead) setSessions([]); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [scope.businessId, scope.locationSlug, range]);

  if (!hydrated || (!location && !locationsFetched)) return <PageLoader />;

  if (!location) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-light)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Welcome to Tandem</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">Create your first location to launch your AI chatbot. It only takes a few minutes.</p>
          <button type="button" onClick={openCreateLocation} className="mt-6 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors">
            Create your first location
          </button>
        </div>
      </div>
    );
  }

  const total = sessions.length;
  const escalated = sessions.filter((s) => s.status === "escalated").length;
  const open = sessions.filter((s) => !s.status || s.status === "open" || s.isUnread).length;
  const resolved = sessions.filter((s) => s.status === "resolved").length;
  const recent = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6);
  const rangeDays = range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">{location.locationName ?? location.name}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{location.location || "No address set"}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(["7d", "30d", "90d"] as RangeKey[]).map((r) => (
            <button key={r} type="button"
              onClick={() => { const p = new URLSearchParams(searchParams.toString()); p.set("range", r); router.replace(`/overview?${p.toString()}`); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"}`}>
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Conversations" value={loading ? "…" : total} sub={rangeDays} />
        <StatCard label="Open / Unread" value={loading ? "…" : open} tone={open > 0 ? "warn" : "default"} />
        <StatCard label="Escalated" value={loading ? "…" : escalated} tone={escalated > 0 ? "warn" : "default"} />
        <StatCard label="Resolved" value={loading ? "…" : resolved} tone={resolved > 0 ? "ok" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Conversation activity <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">(last 14 days)</span></h2>
            <ActivityChart sessions={sessions} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent conversations</h2>
              <Link href="/conversations" className="text-xs font-medium text-[var(--color-primary)] hover:underline">View all →</Link>
            </div>
            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-[var(--color-text)]">No conversations yet</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Install your chat widget to start getting conversations.</p>
                <Link href="/widget" className="mt-3 inline-flex items-center rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                  Get install snippet →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {recent.map((s) => (
                  <li key={s.id}>
                    <Link href={`/conversations?sessionId=${s.id}&businessId=${scope.businessId}&locationSlug=${scope.locationSlug}`}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-hover)]">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[11px] font-bold text-[var(--color-primary)]">
                        {(s.title ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--color-text)]">{s.title ?? "Untitled"}</p>
                          {s.status === "escalated" && <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Escalated</span>}
                          {s.isUnread && !s.status && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />}
                        </div>
                        {s.lastMessageSnippet && <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{s.lastMessageSnippet}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--color-text-secondary)]">{relativeTime(s.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SetupChecklist business={location} />
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Quick actions</h2>
            <div className="space-y-2">
              {[
                { icon: "🍽", label: "Edit menu", href: "/menus" },
                { icon: "📚", label: "Add Q&A", href: "/knowledge" },
                { icon: "💬", label: "View conversations", href: "/conversations" },
                { icon: "🎨", label: "Customize chatbot", href: "/widget" },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                  <span className="text-base">{a.icon}</span>{a.label}
                  <svg className="ml-auto" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5h9M7 2l4.5 4.5L7 11" /></svg>
                </Link>
              ))}
              <button type="button" onClick={openPreview}
                className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2.5 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white">
                <span>▶</span> Preview chat widget
                <svg className="ml-auto" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5h9M7 2l4.5 4.5L7 11" /></svg>
              </button>
            </div>
          </div>
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
