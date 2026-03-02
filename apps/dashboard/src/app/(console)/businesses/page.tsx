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
      <section className="rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-shadow-sm)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">Business</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--console-text-primary)]">{accountBusiness.name}</h2>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">One business account with multiple location-level assistants and settings.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {locations.map((location) => {
          const isActive = active?.id === location.id;
          return (
            <article
              key={location.id}
              className={`rounded-3xl border p-5 transition shadow-sm ${
                isActive
                  ? 'border-[var(--console-primary)] bg-[var(--console-primary-light)] shadow-[var(--console-shadow-sm)]'
                  : 'border-[var(--console-border)] bg-[var(--console-bg-card)] hover:border-[var(--console-border-dark)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">{location.industry}</p>
                  <h3 className="text-xl font-semibold text-[var(--console-text-primary)]">{location.locationName ?? location.location}</h3>
                  <p className="text-sm text-[var(--console-text-tertiary)]">{location.location || "No address"}</p>
                </div>
                {location.theme.logoUrl && (
                  <img
                    src={location.theme.logoUrl}
                    alt="Location logo"
                    className="h-12 w-12 rounded-2xl border border-[var(--console-border)] object-cover"
                  />
                )}
              </div>
              <p className="mt-4 text-sm text-[var(--console-text-secondary)]">{location.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--console-text-secondary)]">
                <span className="rounded-full bg-[var(--console-bg-hover)] px-3 py-1">{location.timezone}</span>
                <span className="rounded-full bg-[var(--console-bg-hover)] px-3 py-1">{location.intents.length} intents</span>
                <span className="rounded-full bg-[var(--console-bg-hover)] px-3 py-1">{location.faqs.length} FAQs</span>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => selectActiveLocation(location.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[var(--console-primary)] text-[var(--console-text-inverse)]'
                      : 'border border-[var(--console-border)] text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]'
                  }`}
                >
                  {isActive ? 'Active' : 'Set active'}
                </button>
                <button
                  type="button"
                  onClick={openCreateLocation}
                  className="rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                >
                  Add location
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {active && (
        <section className="rounded-3xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-shadow-sm)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">Selected location</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--console-text-primary)]">{active.locationName ?? active.location}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--console-text-tertiary)]">Contacts</h4>
              <ul className="mt-2 space-y-2 text-sm text-[var(--console-text-secondary)]">
                {active.contacts.map((contact) => (
                  <li key={contact.id} className="rounded-2xl bg-[var(--console-bg-hover)] px-3 py-2">
                    {contact.label} · {contact.value}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--console-text-tertiary)]">Operating hours</h4>
              <ul className="mt-2 space-y-2 text-sm text-[var(--console-text-secondary)]">
                {active.hours.map((block) => (
                  <li key={block.id} className="rounded-2xl bg-[var(--console-bg-hover)] px-3 py-2">
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
