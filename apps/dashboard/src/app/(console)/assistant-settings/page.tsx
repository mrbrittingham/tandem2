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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Assistant Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Configure assistant personality, safety boundaries, and escalation behavior.</p>
      </header>

      <SectionCard
        title="Tone & personality"
        description="Define how the assistant should sound when responding to guests."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Tone presets are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Guardrails"
        description="Set boundaries for what the assistant should refuse or defer."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Guardrail policies are coming soon.
        </p>
      </SectionCard>

      <SectionCard
        title="Escalation behavior"
        description="Choose when the assistant should route to a human team member."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Configure live handoff behavior from Channels.
        </p>
        <Link
          href="/channels"
          className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Open Channels
        </Link>
      </SectionCard>

      <SectionCard
        title="Allowed actions"
        description="Control which assistant actions and quick tasks are available in chat."
      >
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Existing quick actions are managed in the legacy assistant editor.
        </p>
        <Link
          href="/intents"
          className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Open quick actions
        </Link>
      </SectionCard>
    </div>
  );
}
