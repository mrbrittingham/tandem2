'use client';

import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

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

  const handleConnect = (id: string) => {
    updateBusiness(business.id, (draft) => {
      const integration = draft.integrations.find((entry) => entry.id === id);
      if (!integration) return;
      integration.status = 'connected';
      integration.lastSynced = new Date().toISOString();
      integration.notes = credentials[id] || integration.notes;
    });
  };

  const handleSync = (id: string) => {
    updateBusiness(business.id, (draft) => {
      const integration = draft.integrations.find((entry) => entry.id === id);
      if (!integration) return;
      integration.lastSynced = new Date().toISOString();
      integration.status = 'syncing';
      setTimeout(() => {
        updateBusiness(business.id, (innerDraft) => {
          const again = innerDraft.integrations.find((entry) => entry.id === id);
          if (again) {
            again.status = 'connected';
          }
        });
      }, 1000);
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Integrations</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Connect external systems and keep assistant data in sync.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {business.integrations.map((integration) => (
          <article key={integration.id} className="rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-shadow-sm)]">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">{integration.category}</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--console-text-primary)]">{integration.name}</h2>
            <p className="text-sm text-[var(--console-text-secondary)]">{integration.description}</p>
            <p className="mt-2 text-xs text-[var(--console-text-tertiary)]">
              Status: <span className="font-semibold text-[var(--console-text-primary)]">{integration.status}</span>
            </p>
            {integration.lastSynced && (
              <p className="text-xs text-[var(--console-text-tertiary)]">Last sync: {new Date(integration.lastSynced).toLocaleString()}</p>
            )}
            {integration.status !== 'connected' && (
              <label className="mt-4 flex flex-col gap-2 text-xs text-[var(--console-text-secondary)]">
                {integration.credentialLabel}
                <input
                  value={credentials[integration.id] ?? ''}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, [integration.id]: event.target.value }))}
                  className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-2 text-sm text-[var(--console-text-primary)]"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => handleConnect(integration.id)}
                className={`rounded-2xl px-4 py-2 font-semibold ${
                  integration.status === 'connected'
                    ? 'bg-[var(--console-success-light)] text-[var(--console-success)]'
                    : 'bg-[var(--console-primary)] text-[var(--console-text-inverse)] hover:bg-[var(--console-primary-hover)]'
                }`}
              >
                {integration.status === 'connected' ? 'Connected' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={() => handleSync(integration.id)}
                className="rounded-2xl border border-[var(--console-border)] px-4 py-2 text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
              >
                Trigger sync
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
