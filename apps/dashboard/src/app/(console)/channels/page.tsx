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
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Channels</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Manage delivery channels across website chat and human handoff routes.</p>
      </header>

      <section id="website-widget">
        <SectionCard
          title="Website Widget"
          description="Install and customize the website chat widget for this location."
          actions={<span className="text-[var(--console-text-tertiary)]">{widgetIntegration?.status === "connected" ? "Live" : "Not configured"}</span>}
        >
          <pre className="overflow-x-auto rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-code)] p-4 text-sm text-[var(--console-text-inverse)]">
            <code>{snippet}</code>
          </pre>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/channels#website-widget"
              className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
            >
              View website setup
            </Link>
          </div>
        </SectionCard>
      </section>

      <section id="handoff">
        <SectionCard
          title="Handoff (Talk to a person)"
          description="Control escalation channels for conversations requiring human support."
          actions={<span className="text-[var(--console-text-tertiary)]">{enabledMethods.length ? `${enabledMethods.length} live` : "Not configured"}</span>}
        >
          <p className="text-sm text-[var(--console-text-secondary)]">Status: <span className="font-semibold text-[var(--console-text-primary)]">{business.handoff.status}</span></p>
          <p className="text-sm text-[var(--console-text-secondary)]">Response time: <span className="font-semibold text-[var(--console-text-primary)]">{business.handoff.statusDetail || "Not configured"}</span></p>
          <Link
            href="/channels#handoff"
            className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
          >
              View handoff setup
          </Link>
        </SectionCard>
      </section>

      <SectionCard
        title="Business hours routing"
        description="Set customer handoff timing based on your location hours."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          {business.hours.length ? "Configured from location hours." : "Not configured. Add business hours to enable schedule-aware routing."}
        </p>
        <Link
          href="/businesses"
          className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
        >
          Manage locations
        </Link>
      </SectionCard>
    </div>
  );
}
