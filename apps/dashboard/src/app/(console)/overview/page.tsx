'use client';

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { useActiveBusiness } from "@/lib/store-hooks";

const checklistConfig = [
  {
    label: "Add location hours",
    description: "So your assistant knows when people can visit.",
    href: "/businesses",
    key: "hours",
  },
  {
    label: "Add at least 3 FAQs",
    description: "Give the assistant confident answers.",
    href: "/knowledge-base",
    key: "faqs",
  },
  {
    label: "Set how customers reach you",
    description: "Choose phone, email, or SMS handoff.",
    href: "/channels",
    key: "handoff",
  },
  {
    label: "Add chat to your website",
    description: "Drop the Tandem snippet into your site.",
    href: "/channels",
    key: "widget",
  },
  {
    label: "Test your assistant",
    description: "Try the quick actions before going live.",
    href: "/assistant-settings",
    key: "test",
  },
] as const;

function formatUtcMDY(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
}

export default function OverviewPage() {
  const { openCreateLocation } = useConsoleDialogs();
  const business = useActiveBusiness();
  const previewDock = usePreviewDock();

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

  const hoursComplete = business.hours.length > 0;
  const faqsComplete = enabledFaqs.length >= 3;
  const contactComplete = liveContacts.length > 0;
  const widgetInstalled = widgetIntegration?.status === "connected";
  const assistantTested = business.intents.length >= 1;
  const assistantLive = hoursComplete && faqsComplete && contactComplete && widgetInstalled && assistantTested;

  const checklistProgress: Record<(typeof checklistConfig)[number]["key"], boolean> = {
    hours: hoursComplete,
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

  const conversationCount = Math.max(24, business.intents.length * 6 + enabledFaqs.length * 3);
  const activeUsers = Math.max(120, business.intents.length * 14 + enabledFaqs.length * 9 + 84);
  const averageResponse = contactComplete ? "1.2s" : "2.8s";
  const mostAsked = enabledFaqs[0]?.question ?? enabledPolicies[0]?.title ?? "Add FAQs to unlock insights";
  const handoffRate = contactComplete ? `${Math.min(60, liveContacts.length * 12 + 16)}%` : "—";
  const responseTime = business.handoff.statusDetail || "Set response time";

  const kpis = [
    {
      label: "Total Conversations",
      value: conversationCount.toLocaleString(),
      trend: "↗ +12%",
      helper: "vs last month",
    },
    {
      label: "Active Users",
      value: activeUsers.toLocaleString(),
      trend: "↗ +8%",
      helper: "vs last month",
    },
    {
      label: "Avg Response Time",
      value: averageResponse,
      trend: "↗ -15%",
      helper: "vs last month",
    },
  ];

  const recentConversations = [
    {
      id: "c1",
      name: "Emily Chen",
      message: mostAsked,
      age: "2m ago",
      state: "active",
      initials: "EC",
    },
    {
      id: "c2",
      name: "Michael Torres",
      message: "Can I adjust my reservation for tonight?",
      age: "15m ago",
      state: "resolved",
      initials: "MT",
    },
    {
      id: "c3",
      name: "Sarah Williams",
      message: "What pairings are available this weekend?",
      age: "1h ago",
      state: "active",
      initials: "SW",
    },
  ];

  return (
    <div className="space-y-[var(--console-section-gap)]">
      <header className="space-y-1">
        <h1 className="text-[var(--console-text-3xl)] font-semibold leading-[var(--console-leading-tight)] text-[var(--console-text-primary)]">Overview</h1>
        <p className="text-[var(--console-text-base)] text-[var(--console-text-secondary)]">Monitor your assistant&apos;s performance and engagement metrics</p>
      </header>

      <section className="grid gap-[var(--console-grid-gap)] lg:grid-cols-3">
        {kpis.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[var(--console-card-radius)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-[var(--console-card-pad)] shadow-[var(--console-card-shadow)]"
          >
            <p className="text-[var(--console-text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--console-text-tertiary)]">{metric.label}</p>
            <p className="mt-3 text-[var(--console-text-3xl)] font-semibold leading-[var(--console-leading-tight)] text-[var(--console-text-primary)]">{metric.value}</p>
            <p className="mt-1 text-[var(--console-text-xs)] text-[var(--console-text-secondary)]">
              <span className="font-semibold text-[var(--console-success)]">{metric.trend}</span> {metric.helper}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-[var(--console-grid-gap)] lg:grid-cols-3">
        <article className="rounded-[var(--console-card-radius)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-[var(--console-card-pad)] shadow-[var(--console-card-shadow)] lg:col-span-2">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[var(--console-text-xl)] font-semibold text-[var(--console-text-primary)]">Performance Summary</h2>
              <p className="text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">Last 30 days</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-[var(--console-radius-full)] bg-[var(--console-primary)] px-4 text-[var(--console-text-xs)] font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
            >
              View Details
            </button>
          </header>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">
                  <span>Resolution Rate</span>
                  <span className="font-semibold text-[var(--console-text-primary)]">94%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--console-border-light)]">
                  <div className="h-1.5 rounded-full bg-[var(--console-primary)]" style={{ width: "94%" }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">
                  <span>Customer Satisfaction</span>
                  <span className="font-semibold text-[var(--console-text-primary)]">4.8/5</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--console-border-light)]">
                  <div className="h-1.5 rounded-full bg-[var(--console-success)]" style={{ width: "96%" }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">
                  <span>Handoff Rate</span>
                  <span className="font-semibold text-[var(--console-text-primary)]">{handoffRate}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--console-border-light)]">
                  <div className="h-1.5 rounded-full bg-[var(--console-warning)]" style={{ width: handoffRate === "—" ? "6%" : handoffRate }} />
                </div>
              </div>
            </div>
            <dl className="grid gap-1.5 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">
              <div className="flex items-center justify-between rounded-[var(--console-radius-sm)] bg-[var(--console-bg-page)] px-3 py-2">
                <dt>Peak Hours</dt>
                <dd className="font-semibold text-[var(--console-text-primary)]">2PM - 6PM</dd>
              </div>
              <div className="flex items-center justify-between rounded-[var(--console-radius-sm)] bg-[var(--console-bg-page)] px-3 py-2">
                <dt>Busiest Day</dt>
                <dd className="font-semibold text-[var(--console-text-primary)]">Friday</dd>
              </div>
              <div className="flex items-center justify-between rounded-[var(--console-radius-sm)] bg-[var(--console-bg-page)] px-3 py-2">
                <dt>Avg Response</dt>
                <dd className="font-semibold text-[var(--console-text-primary)]">{responseTime}</dd>
              </div>
              <div className="flex items-center justify-between rounded-[var(--console-radius-sm)] bg-[var(--console-bg-page)] px-3 py-2">
                <dt>Top Topic</dt>
                <dd className="max-w-[180px] truncate text-right font-semibold text-[var(--console-text-primary)]">{mostAsked}</dd>
              </div>
            </dl>
          </div>
        </article>

        <div className="space-y-[var(--console-grid-gap)]">
          <article className="rounded-[var(--console-card-radius)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-[var(--console-card-pad)] shadow-[var(--console-card-shadow)]">
            <h3 className="text-[var(--console-text-lg)] font-semibold text-[var(--console-text-primary)]">Assistant Status</h3>
            <p className="mt-1 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">All systems operational. Processing conversations normally.</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-[var(--console-radius-full)] bg-[var(--console-success-light)] px-3 py-1 text-[var(--console-text-xs)] font-semibold text-[var(--console-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--console-success)]" />
              {assistantLive ? "Live & Active" : "Needs setup"}
            </span>
          </article>

          <article className="rounded-[var(--console-card-radius)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-[var(--console-card-pad)] shadow-[var(--console-card-shadow)]">
            <h3 className="text-[var(--console-text-lg)] font-semibold text-[var(--console-text-primary)]">Knowledge Base</h3>
            <p className="mt-1 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">{enabledFaqs.length} FAQs enabled. {enabledPolicies.length} policies published.</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex rounded-[var(--console-radius-full)] bg-[var(--console-warning-light)] px-3 py-1 text-[var(--console-text-xs)] font-semibold text-[var(--console-warning)]">
                {enabledFaqs.length < 3 ? "Needs Update" : "Healthy"}
              </span>
              <Link href="/knowledge-base" className="text-[var(--console-text-xs)] font-semibold text-[var(--console-primary)]">Review ›</Link>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-[var(--console-grid-gap)] xl:grid-cols-[minmax(320px,1fr)_minmax(0,1.9fr)]">
        <SectionCard
          title="Setup Checklist"
          description="Get your assistant ready"
          actions={<span>{completedCount} of {checklistState.length} completed</span>}
        >
          <div className="space-y-2">
            {checklistState.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-[var(--console-radius-md)] border px-3 py-2 text-left transition ${
                  item.completed
                    ? "border-[var(--console-success-light)] bg-[var(--console-bg-page)]"
                    : "border-[var(--console-card-border)] bg-[var(--console-bg-card)] hover:bg-[var(--console-bg-hover)]"
                }`}
              >
                <div>
                  <p className="text-[var(--console-text-sm)] font-semibold text-[var(--console-text-primary)]">{item.label}</p>
                  <p className="text-[var(--console-text-xs)] text-[var(--console-text-secondary)]">{item.description}</p>
                </div>
                <span
                  className={`ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    item.completed
                      ? "bg-[var(--console-success)] text-[var(--console-text-inverse)]"
                      : "border border-[var(--console-border-dark)] text-[var(--console-text-tertiary)]"
                  }`}
                >
                  {item.completed ? "✓" : ""}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Conversations"
          description="Last 2 hours"
          actions={
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="inline-flex h-8 items-center rounded-[var(--console-radius-full)] bg-[var(--console-primary)] px-4 text-[var(--console-text-xs)] font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
            >
              View All
            </button>
          }
        >
          <div className="space-y-2">
            {recentConversations.map((item) => (
              <article key={item.id} className="flex items-start gap-3 rounded-[var(--console-radius-md)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] px-3 py-2.5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--console-primary-light)] text-[var(--console-text-xs)] font-semibold text-[var(--console-primary)]">{item.initials}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[var(--console-text-sm)] font-semibold text-[var(--console-text-primary)]">{item.name}</p>
                    <p className="text-[var(--console-text-xs)] text-[var(--console-text-tertiary)]">{item.age}</p>
                  </div>
                  <p className="truncate text-[var(--console-text-xs)] text-[var(--console-text-secondary)]">{item.message}</p>
                  <span className={`mt-1 inline-flex rounded-[var(--console-radius-full)] px-2 py-0.5 text-[10px] font-semibold ${
                    item.state === "resolved"
                      ? "bg-[var(--console-success-light)] text-[var(--console-success)]"
                      : "bg-[var(--console-primary-light)] text-[var(--console-primary)]"
                  }`}>{item.state.toUpperCase()}</span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <p className="text-[var(--console-text-xs)] text-[var(--console-text-tertiary)]" suppressHydrationWarning>
        Last updated {formatUtcMDY(business.updatedAt)}
      </p>
    </div>
  );
}
