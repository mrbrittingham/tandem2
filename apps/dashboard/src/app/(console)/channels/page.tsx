'use client';

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { useActiveBusiness } from "@/lib/store-hooks";

export default function ChannelsPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure widget and live handoff channels."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const widgetIntegration = business.integrations.find((integration) =>
    integration.category.toLowerCase().includes("website") || integration.name.toLowerCase().includes("widget"),
  );

  const snippetId = business.locationSlug ?? business.slug;
  const snippet = `<script async src="https://cdn.tandem.dev/widget.js" data-location="${snippetId}"></script>`;
  const enabledMethods = business.handoff.contactMethods.filter((method) => method.enabled);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Channels</h1>
        <p className="mt-2 text-sm text-slate-500">Manage delivery channels across website chat and human handoff routes.</p>
      </header>

      <section id="website-widget">
        <SectionCard
          title="Website Widget"
          description="Install and customize the website chat widget for this location."
          actions={<span className="text-slate-500">{widgetIntegration?.status === "connected" ? "Live" : "Not configured"}</span>}
        >
          <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-900 p-4 text-sm text-slate-100">
            <code>{snippet}</code>
          </pre>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/channels#website-widget"
              className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Website widget section
            </Link>
          </div>
        </SectionCard>
      </section>

      <section id="handoff">
        <SectionCard
          title="Handoff (Talk to a person)"
          description="Control escalation channels for conversations requiring human support."
          actions={<span className="text-slate-500">{enabledMethods.length ? `${enabledMethods.length} live` : "Not configured"}</span>}
        >
          <p className="text-sm text-slate-700">Status: <span className="font-semibold text-slate-900">{business.handoff.status}</span></p>
          <p className="text-sm text-slate-700">Response time: <span className="font-semibold text-slate-900">{business.handoff.statusDetail || "Not configured"}</span></p>
          <Link
            href="/channels#handoff"
            className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Handoff section
          </Link>
        </SectionCard>
      </section>

      <SectionCard
        title="Business hours routing"
        description="Route conversations based on location hours and availability windows."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {business.hours.length ? "Configured from location hours." : "Not configured. Add business hours to enable schedule-aware routing."}
        </p>
        <Link
          href="/businesses"
          className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Manage locations
        </Link>
      </SectionCard>
    </div>
  );
}
