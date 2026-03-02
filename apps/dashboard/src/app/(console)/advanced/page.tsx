'use client';

import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";

export default function AdvancedPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Advanced</h1>
        <p className="mt-2 text-sm text-slate-500">Inspect model configuration, system health, and debug surfaces.</p>
      </header>

      <section id="llm-status">
        <SectionCard
          title="Model / LLM status"
          description="Provider, model, and key checks are available in this section."
        >
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            LLM status is not configured in this consolidated view yet.
          </p>
          <Link
            href="/advanced#llm-status"
            className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            LLM status anchor
          </Link>
        </SectionCard>
      </section>

      <SectionCard
        title="System health"
        description="Operational readiness checks for core services."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Consolidated health checks are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Logs / Debug"
        description="Debug traces and diagnostics for support and troubleshooting."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Coming soon. Debug logs will appear here.
        </p>
      </SectionCard>
    </div>
  );
}
