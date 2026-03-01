'use client';

import { selectActiveBusiness } from "@/lib/store-hooks";
import { useActiveBusiness, useBusinesses } from "@/lib/store-hooks";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { EmptyState } from "@/components/EmptyState";

export default function BusinessesPage() {
  const businesses = useBusinesses();
  const active = useActiveBusiness();
  const { openCreateBusiness } = useConsoleDialogs();

  if (!businesses.length) {
    return (
      <EmptyState
        title="No businesses yet"
        description="Spin up a concierge to configure assistant content, live routing, and installs."
        actionLabel="Create business"
        onAction={openCreateBusiness}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">
        {businesses.map((business) => {
          const isActive = active?.id === business.id;
          return (
            <article
              key={business.id}
              className={`rounded-3xl border p-5 transition shadow-sm ${
                isActive
                  ? 'border-blue-200 bg-blue-50 shadow-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{business.industry}</p>
                  <h3 className="text-xl font-semibold text-slate-900">{business.name}</h3>
                  <p className="text-sm text-slate-500">{business.location}</p>
                </div>
                {business.theme.logoUrl && (
                  <img
                    src={business.theme.logoUrl}
                    alt="Business logo"
                    className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                  />
                )}
              </div>
              <p className="mt-4 text-sm text-slate-600">{business.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{business.timezone}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{business.intents.length} intents</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{business.faqs.length} FAQs</span>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => selectActiveBusiness(business.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {isActive ? 'Active' : 'Set active'}
                </button>
                <button
                  type="button"
                  onClick={openCreateBusiness}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
                >
                  Duplicate template
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {active && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Selected business</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{active.name}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Contacts</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {active.contacts.map((contact) => (
                  <li key={contact.id} className="rounded-2xl bg-slate-100 px-3 py-2">
                    {contact.label} · {contact.value}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Operating hours</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {active.hours.map((block) => (
                  <li key={block.id} className="rounded-2xl bg-slate-100 px-3 py-2">
                    {block.label} · {block.days.join(', ')} · {block.open} - {block.close}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
