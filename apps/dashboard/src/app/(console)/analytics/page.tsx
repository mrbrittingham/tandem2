'use client';

import { SectionCard } from "@/components/SectionCard";

const analyticsCards = [
  { title: "Conversation volume", state: "Coming soon" },
  { title: "Handoff rate", state: "Coming soon" },
  { title: "Response time", state: "Coming soon" },
  { title: "Most asked questions", state: "Coming soon" },
  { title: "Channel breakdown", state: "Coming soon" },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Analytics</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Track assistant performance and customer behavior across channels.</p>
      </header>

      <SectionCard
        title="Performance"
        description="Core analytics views for conversations, handoffs, and response quality."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {analyticsCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4">
              <h2 className="text-sm font-semibold text-[var(--console-text-primary)]">{card.title}</h2>
              <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">{card.state}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
