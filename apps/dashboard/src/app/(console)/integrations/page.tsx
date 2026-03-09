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
      description="Connect the tools your team uses so customer answers stay current."
      titleClassName="text-xl"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {business.integrations.map((integration) => (
          <article key={integration.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-5">
            <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{integration.category}</p>
            <h3 className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">{integration.name}</h3>
            <p className="mt-1 text-[var(--text-sm)] text-[var(--color-text-secondary)]">{integration.description}</p>
            <div className="mt-3">
              <StatusBadge
                label={integration.status === "connected" ? "Connected" : integration.status === "syncing" ? "Syncing" : "Not connected"}
                tone={integration.status === "connected" ? "success" : integration.status === "syncing" ? "info" : "neutral"}
              />
            </div>
            {integration.lastSynced ? (
              <p className="mt-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">Last synced: {new Date(integration.lastSynced).toLocaleString()}</p>
            ) : null}
            {integration.status !== "connected" ? (
              <label className="mt-4 flex flex-col gap-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                {integration.credentialLabel}
                <input
                  value={credentials[integration.id] ?? ""}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, [integration.id]: event.target.value }))}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)]"
                />
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-[var(--text-sm)]">
              <button
                type="button"
                onClick={() => handleConnect(integration.id)}
                className={`rounded-[var(--radius-md)] px-4 py-2 font-semibold ${
                  integration.status === "connected"
                    ? "bg-[var(--color-success-subtle)] text-[var(--color-success)]"
                    : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                }`}
              >
                {integration.status === "connected" ? "Connected" : "Connect account"}
              </button>
              <button
                type="button"
                onClick={() => handleSync(integration.id)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
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
