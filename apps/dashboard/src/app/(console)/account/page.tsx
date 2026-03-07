'use client';

import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";
import { useAccountBusiness, useLocations } from "@/lib/store-hooks";

export default function AccountPage() {
  const account = useAccountBusiness();
  const locations = useLocations();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Account</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Manage business details, team access, billing, and account security.</p>
      </header>

      <SectionCard title="Business info" description="Business identity and profile details.">
        <p className="text-sm text-[var(--console-text-secondary)]">Business: <span className="font-semibold text-[var(--console-text-primary)]">{account.name ?? "Not configured"}</span></p>
      </SectionCard>

      <SectionCard title="Locations" description="Location assistants connected to this account.">
        <p className="text-sm text-[var(--console-text-secondary)]">{locations.length ? `${locations.length} locations configured` : "Not configured"}</p>
        <Link
          href="/businesses"
          className="inline-flex rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-dark)]"
        >
          Manage locations
        </Link>
      </SectionCard>

      <SectionCard title="Users & roles" description="Team members and permission levels.">
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. User management is coming soon.
        </p>
      </SectionCard>

      <SectionCard title="Billing / Plan" description="Subscription and plan settings.">
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Billing controls are coming soon.
        </p>
      </SectionCard>

      <SectionCard title="Security" description="Authentication and account protection settings.">
        <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
          Not configured. Security controls are coming soon.
        </p>
      </SectionCard>
    </div>
  );
}
