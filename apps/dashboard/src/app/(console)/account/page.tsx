'use client';

import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";
import { useAccountBusiness, useLocations } from "@/lib/store-hooks";

export default function AccountPage() {
  const account = useAccountBusiness();
  const locations = useLocations();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
        <p className="mt-2 text-sm text-slate-500">Manage business profile, access, billing, and security settings.</p>
      </header>

      <SectionCard title="Business info" description="Business identity and profile details.">
        <p className="text-sm text-slate-700">Business: <span className="font-semibold text-slate-900">{account.name ?? "Not configured"}</span></p>
      </SectionCard>

      <SectionCard title="Locations" description="Location assistants connected to this account.">
        <p className="text-sm text-slate-700">{locations.length ? `${locations.length} locations configured` : "Not configured"}</p>
        <Link
          href="/businesses"
          className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Manage locations
        </Link>
      </SectionCard>

      <SectionCard title="Users & roles" description="Team members and permission levels.">
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. User management is coming soon.
        </p>
      </SectionCard>

      <SectionCard title="Billing / Plan" description="Subscription and plan settings.">
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Billing controls are coming soon.
        </p>
      </SectionCard>

      <SectionCard title="Security" description="Authentication and account protection settings.">
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Not configured. Security controls are coming soon.
        </p>
      </SectionCard>
    </div>
  );
}
