'use client';

import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";

export default function AdvancedPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Advanced</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Review assistant readiness, service health, and troubleshooting tools.</p>
      </header>

      <section id="llm-status">
        <SectionCard
          title="AI service status"
          description="Review provider health and readiness checks for assistant responses."
        >
          <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
            LLM status is not configured in this consolidated view yet.
          </p>
          <Link
            href="/advanced#llm-status"
            className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
          >
            Jump to AI status
          </Link>
        </SectionCard>
      </section>

      <SectionCard
        title="System health"
        description="Operational readiness checks for core services."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Consolidated health checks are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Troubleshooting logs"
        description="Use logs and diagnostics to investigate support issues quickly."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Coming soon. Debug logs will appear here.
        </p>
      </SectionCard>
    </div>
  );
}
