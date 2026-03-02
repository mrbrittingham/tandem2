'use client';

import Link from "next/link";

export default function ReportsPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-900/5">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Reports</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Reports coming soon</h1>
      <p className="mt-3 text-sm text-slate-600">
        Analytics dashboards are not wired yet in this build. Use Conversations and Overview for current location insights.
      </p>
      <div className="mt-6">
        <Link
          href="/overview"
          className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Back to overview
        </Link>
      </div>
    </section>
  );
}
