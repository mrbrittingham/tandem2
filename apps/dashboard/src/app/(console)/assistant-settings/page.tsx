'use client';

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { useActiveBusiness } from "@/lib/store-hooks";

export default function AssistantSettingsPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure assistant behavior and escalation settings."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Assistant Setup</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Set how your assistant sounds, what it should avoid, and when to hand off.</p>
      </header>

      <SectionCard
        title="Tone & personality"
        description="Define how the assistant should sound when responding to guests."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Tone presets are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Response boundaries"
        description="Set limits for topics your assistant should avoid or defer."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Guardrail policies are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Escalation behavior"
        description="Choose when the assistant should route to a human team member."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Configure live handoff behavior from Channels.
        </p>
        <Link
          href="/channels"
          className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
        >
          Open Channels
        </Link>
      </SectionCard>

      <SectionCard
        title="Allowed actions"
        description="Control which assistant actions and quick tasks are available in chat."
      >
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Configure and review quick actions in the intent rules section on this page.
        </p>
        <Link
          href="/assistant-settings#intent-rules"
          className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
        >
          Jump to intent rules
        </Link>
      </SectionCard>

      <section id="intent-rules">
        <SectionCard
          title="Suggested actions"
          description="Review actions customers can tap to get help quickly."
          actions={<span className="text-[var(--console-text-tertiary)]">{business.intents.length} configured</span>}
        >
          {business.intents.length ? (
            <div className="space-y-3">
              {business.intents.map((intent) => (
                <article key={intent.id} className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">{intent.route.type}</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--console-text-primary)]">{intent.label}</h3>
                  <p className="text-sm text-[var(--console-text-secondary)]">{intent.description}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
              Not configured. No intent rules are set for this location.
            </p>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
