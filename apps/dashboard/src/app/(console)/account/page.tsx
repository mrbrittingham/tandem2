'use client';

import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useActiveBusiness, useLocations } from "@/lib/store-hooks";

export default function AccountPage() {
  const business = useActiveBusiness();
  const locations = useLocations();

  const phone = business?.contacts?.find((c) => c.type === "phone")?.value;
  const email = business?.contacts?.find((c) => c.type === "email")?.value;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Account</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Manage business details, team access, billing, and integrations.</p>
      </header>

      {/* Business identity */}
      <SectionCard title="Business identity" description="Your business profile used across all locations.">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Business name</dt>
            <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">
              {business?.businessName ?? business?.name ?? "Not configured"}
            </dd>
          </div>
          {business?.tagline ? (
            <div>
              <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Tagline</dt>
              <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">{business.tagline}</dd>
            </div>
          ) : null}
          {business?.location ? (
            <div>
              <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Address</dt>
              <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">{business.location}</dd>
            </div>
          ) : null}
          {business?.timezone ? (
            <div>
              <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Timezone</dt>
              <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">{business.timezone}</dd>
            </div>
          ) : null}
          {phone ? (
            <div>
              <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Phone</dt>
              <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">{phone}</dd>
            </div>
          ) : null}
          {email ? (
            <div>
              <dt className="text-xs font-medium text-[var(--console-text-tertiary)]">Email</dt>
              <dd className="mt-0.5 text-sm text-[var(--console-text-primary)]">{email}</dd>
            </div>
          ) : null}
        </dl>
      </SectionCard>

      {/* Locations */}
      <SectionCard title="Locations" description="Location assistants connected to this account.">
        <p className="text-sm text-[var(--console-text-secondary)]">
          {locations.length
            ? `${locations.length} location${locations.length !== 1 ? "s" : ""} configured`
            : "No locations configured."}
        </p>
      </SectionCard>

      {/* Integrations */}
      <SectionCard
        title="Integrations"
        description="Connect the tools your team uses so customer answers stay current."
      >
        {business?.integrations?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {business.integrations.map((integration) => (
              <div
                key={integration.id}
                className="rounded-xl border border-[var(--console-border)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--console-text-tertiary)]">
                  {integration.category}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--console-text-primary)]">
                  {integration.name}
                </p>
                <p className="mt-0.5 text-sm text-[var(--console-text-secondary)]">
                  {integration.description}
                </p>
                <div className="mt-2">
                  <StatusBadge
                    label={
                      integration.status === "connected"
                        ? "Connected"
                        : integration.status === "syncing"
                          ? "Syncing"
                          : "Not connected"
                    }
                    tone={
                      integration.status === "connected"
                        ? "success"
                        : integration.status === "syncing"
                          ? "info"
                          : "neutral"
                    }
                  />
                </div>
                {integration.lastSynced ? (
                  <p className="mt-1 text-xs text-[var(--console-text-tertiary)]">
                    Last synced: {new Date(integration.lastSynced).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
            No integrations configured.
          </p>
        )}
      </SectionCard>

      {/* Users & roles */}
      <SectionCard title="Users & roles" description="Team members and permission levels.">
        <p className="rounded-xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          User management coming soon.
        </p>
      </SectionCard>

      {/* Billing */}
      <SectionCard title="Billing / Plan" description="Subscription and plan settings.">
        <p className="rounded-xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Billing controls coming soon.
        </p>
      </SectionCard>

      {/* Security */}
      <SectionCard title="Security" description="Authentication and account protection settings.">
        <p className="rounded-xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Security controls coming soon.
        </p>
      </SectionCard>
    </div>
  );
}
