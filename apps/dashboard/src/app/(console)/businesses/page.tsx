'use client';

import { selectActiveLocation, useAccountBusiness, useActiveLocation, useLocations } from "@/lib/store-hooks";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { EmptyState } from "@/components/EmptyState";

export default function BusinessesPage() {
  const locations = useLocations();
  const active = useActiveLocation();
  const accountBusiness = useAccountBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!locations.length) {
    return (
      <EmptyState
        title="No locations yet"
        description="Add a location to configure assistant content, live routing, and installs."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Business</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{accountBusiness.name}</h2>
        <p className="mt-2 text-sm text-slate-500">One business account with multiple location-level assistants and settings.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {locations.map((location) => {
          const isActive = active?.id === location.id;
          return (
            <article
              key={location.id}
              className={`rounded-3xl border p-5 transition shadow-sm ${
                isActive
                  ? 'border-blue-200 bg-blue-50 shadow-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{location.industry}</p>
                  <h3 className="text-xl font-semibold text-slate-900">{location.locationName ?? location.location}</h3>
                  <p className="text-sm text-slate-500">{location.location || "No address"}</p>
                </div>
                {location.theme.logoUrl && (
                  <img
                    src={location.theme.logoUrl}
                    alt="Location logo"
                    className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                  />
                )}
              </div>
              <p className="mt-4 text-sm text-slate-600">{location.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{location.timezone}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{location.intents.length} intents</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{location.faqs.length} FAQs</span>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => selectActiveLocation(location.id)}
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
                  onClick={openCreateLocation}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
                >
                  Add location
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {active && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Selected location</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{active.locationName ?? active.location}</h3>
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
