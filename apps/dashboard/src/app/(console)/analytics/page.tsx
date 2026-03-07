'use client';

import { SectionCard } from "@/components/SectionCard";

const analyticsCards = [
  { title: "Conversation volume", state: "Data will appear as conversations come in." },
  { title: "Handoff rate", state: "Data will appear after handoffs are used." },
  { title: "Response time", state: "Data will appear once enough responses are recorded." },
  { title: "Most asked questions", state: "Data will appear after common topics are detected." },
  { title: "Channel breakdown", state: "Data will appear when multiple channels are active." },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Analytics</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Track assistant performance and customer behavior over time.</p>
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
