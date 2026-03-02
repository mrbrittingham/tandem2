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
        <h1 className="text-3xl font-semibold text-slate-900">Integrations</h1>
        <p className="mt-2 text-sm text-slate-500">Connect external systems and keep assistant data in sync.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {business.integrations.map((integration) => (
          <article key={integration.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">{integration.category}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{integration.name}</h2>
            <p className="text-sm text-slate-600">{integration.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              Status: <span className="font-semibold text-slate-800">{integration.status}</span>
            </p>
            {integration.lastSynced && (
              <p className="text-xs text-slate-500">Last sync: {new Date(integration.lastSynced).toLocaleString()}</p>
            )}
            {integration.status !== 'connected' && (
              <label className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                {integration.credentialLabel}
                <input
                  value={credentials[integration.id] ?? ''}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, [integration.id]: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => handleConnect(integration.id)}
                className={`rounded-2xl px-4 py-2 font-semibold ${
                  integration.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {integration.status === 'connected' ? 'Connected' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={() => handleSync(integration.id)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700 hover:border-slate-300"
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
