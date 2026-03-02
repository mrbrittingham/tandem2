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
  const mostAsked = enabledFaqs[0]?.question ?? enabledPolicies[0]?.title ?? "Add FAQs to unlock insights";
  const handoffRate = contactComplete ? `${Math.min(60, liveContacts.length * 12 + 16)}%` : "—";
  const responseTime = business.handoff.statusDetail || "Set response time";

  const metrics = [
    { label: "Conversations (30 days)", value: conversationCount.toLocaleString(), helper: "Simulated volume" },
    { label: "Most asked question", value: mostAsked, helper: "Based on FAQs" },
    { label: "Handoff rate", value: handoffRate, helper: contactComplete ? "Live channels" : "Enable a channel" },
    { label: "Response time", value: responseTime, helper: "From Talk to a person" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-2 text-sm text-slate-500">Track readiness, setup progress, and assistant launch status.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Status</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Assistant overview</h2>
              <p className="text-sm text-slate-500">Track go-live readiness at a glance.</p>
            </div>
            <button
              type="button"
              onClick={() => previewDock.open()}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
            >
              Preview
            </button>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Assistant status</dt>
              <dd className={`mt-2 text-xl font-semibold ${assistantLive ? 'text-emerald-600' : 'text-amber-600'}`}>
                {assistantLive ? 'Live' : 'Not live'}
              </dd>
              <p className="text-xs text-slate-500">{assistantLive ? 'All setup steps complete' : 'Finish the checklist below'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Website installed</dt>
              <dd className="mt-2 text-xl font-semibold text-slate-900">{widgetInstalled ? 'Yes' : 'Not yet'}</dd>
              <p className="text-xs text-slate-500">
                {widgetInstalled ? 'Snippet detected' : 'Add the Tandem snippet'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Last updated</dt>
              <dd
                className="mt-2 text-xl font-semibold text-slate-900"
                suppressHydrationWarning
              >
                {formatUtcMDY(business.updatedAt)}
              </dd>
              <p className="text-xs text-slate-500">Keep content fresh</p>
            </div>
          </dl>
        </section>

        <SectionCard
          title="Performance snapshot"
          description="High-level metrics for the past 30 days."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
                <p className="text-xs text-slate-500">{metric.helper}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Setup checklist"
        description="Finish these five steps to launch a confident assistant."
        actions={<span className="text-slate-500">{completedCount} of {checklistState.length} complete</span>}
      >
        <div className="space-y-3">
          {checklistState.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                item.completed
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-blue-200'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
              <span
                className={`ml-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  item.completed ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-slate-500'
                }`}
              >
                {item.completed ? '✓' : ''}
              </span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
