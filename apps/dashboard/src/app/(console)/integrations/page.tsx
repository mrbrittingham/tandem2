'use client';

import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";
import { saveLocationConfig } from "@/lib/location-config-client";

export default function IntegrationsPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to connect POS, reservations, and commerce systems."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const persistIntegrations = (nextIntegrations: typeof business.integrations) => {
    void saveLocationConfig({
      location: business,
      integrationsConfig: {
        integrations: nextIntegrations,
      },
    }).catch(() => {
      // keep local state when remote save fails
    });
  };

  const handleConnect = (id: string) => {
    let updatedIntegrations = business.integrations;
    updateBusiness(business.id, (draft) => {
      const integration = draft.integrations.find((entry) => entry.id === id);
      if (!integration) return;
      integration.status = 'connected';
      integration.lastSynced = new Date().toISOString();
      integration.notes = credentials[id] || integration.notes;
      updatedIntegrations = [...draft.integrations];
    });
    persistIntegrations(updatedIntegrations);
  };

  const handleSync = (id: string) => {
    let updatedIntegrations = business.integrations;
    updateBusiness(business.id, (draft) => {
      const integration = draft.integrations.find((entry) => entry.id === id);
      if (!integration) return;
      integration.lastSynced = new Date().toISOString();
      integration.status = 'syncing';
      updatedIntegrations = [...draft.integrations];
      setTimeout(() => {
        let delayedIntegrations = updatedIntegrations;
        updateBusiness(business.id, (innerDraft) => {
          const again = innerDraft.integrations.find((entry) => entry.id === id);
          if (again) {
            again.status = 'connected';
          }
          delayedIntegrations = [...innerDraft.integrations];
        });
        persistIntegrations(delayedIntegrations);
      }, 1000);
    });
    persistIntegrations(updatedIntegrations);
  };

  return (
    <SectionCard
      eyebrow="Connected Tools"
      title="Integrations"
      description="Connect your business tools so your assistant can stay up to date."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {business.integrations.map((integration) => (
          <article key={integration.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{integration.category}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{integration.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{integration.description}</p>
            <div className="mt-3">
              <StatusBadge
                label={integration.status === "connected" ? "Connected" : integration.status === "syncing" ? "Syncing" : "Not connected"}
                tone={integration.status === "connected" ? "success" : integration.status === "syncing" ? "info" : "neutral"}
              />
            </div>
            {integration.lastSynced ? (
              <p className="mt-2 text-xs text-slate-500">Last synced: {new Date(integration.lastSynced).toLocaleString()}</p>
            ) : null}
            {integration.status !== "connected" ? (
              <label className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                {integration.credentialLabel}
                <input
                  value={credentials[integration.id] ?? ""}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, [integration.id]: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900"
                />
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => handleConnect(integration.id)}
                className={`rounded-2xl px-4 py-2 font-semibold ${
                  integration.status === "connected"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[var(--console-primary)] text-white hover:bg-[var(--console-primary-hover)]"
                }`}
              >
                {integration.status === "connected" ? "Connected" : "Connect"}
              </button>
              <button
                type="button"
                onClick={() => handleSync(integration.id)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700 hover:border-slate-300"
              >
                Sync now
              </button>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
