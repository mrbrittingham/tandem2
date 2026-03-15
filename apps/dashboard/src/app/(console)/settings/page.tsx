'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContactMethod, OperatingHoursBlock } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type DaySchedule = {
  open: boolean;
  openTime: string;
  closeTime: string;
};

type GeneralForm = {
  businessName: string;
  tagline: string;
  timezone: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  hours: Record<string, DaySchedule>;
};

function defaultSchedule(): Record<string, DaySchedule> {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      {
        open: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(day),
        openTime: "11:00",
        closeTime: "21:00",
      },
    ]),
  );
}

function hoursFromBlocks(blocks: OperatingHoursBlock[]): Record<string, DaySchedule> {
  const base = defaultSchedule();
  for (const block of blocks) {
    for (const day of block.days) {
      if (DAYS.includes(day as (typeof DAYS)[number])) {
        base[day] = { open: true, openTime: block.open, closeTime: block.close };
      }
    }
  }
  return base;
}

function hoursToBlocks(schedule: Record<string, DaySchedule>): OperatingHoursBlock[] {
  return DAYS.filter((d) => schedule[d]?.open).map((day) => ({
    id: crypto.randomUUID(),
    label: day,
    days: [day],
    open: schedule[day].openTime,
    close: schedule[day].closeTime,
  }));
}

function buildForm(business: NonNullable<ReturnType<typeof useActiveBusiness>>): GeneralForm {
  const phone = business.contacts.find((c) => c.type === "phone")?.value ?? "";
  const email = business.contacts.find((c) => c.type === "email")?.value ?? "";
  return {
    businessName: business.businessName ?? business.name,
    tagline: business.tagline ?? "",
    timezone: business.timezone ?? "UTC",
    address: business.location ?? "",
    phone: formatPhone(phone),
    email,
    website: "",
    hours: hoursFromBlocks(business.hours ?? []),
  };
}

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris", "Asia/Tokyo",
];

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h24 = Math.floor((i * 15) / 60);
  const min = (i * 15) % 60;
  const isPm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  return {
    value: `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    label: `${h12}:${String(min).padStart(2, "0")} ${isPm ? "PM" : "AM"}`,
  };
});

function snapToOption(value: string) {
  const [hStr, mStr] = value.split(":");
  const h24 = parseInt(hStr ?? "9", 10);
  const rawM = parseInt(mStr ?? "0", 10);
  const snappedM = Math.round(rawM / 15) * 15;
  const overflow = snappedM >= 60;
  const finalH = overflow ? (h24 + 1) % 24 : h24;
  const finalM = overflow ? 0 : snappedM;
  return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const snapped = snapToOption(value);
  return (
    <div className="relative">
      <select
        value={snapped}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-36 rounded-xl border border-[var(--color-border)] bg-white pl-4 pr-9 py-2.5 text-sm font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer transition-colors"
      >
        {TIME_OPTIONS.map(({ value: v, label }) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 text-[var(--color-text-secondary)]">
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4L4 1L7 4" />
        </svg>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1L4 4L7 1" />
        </svg>
      </div>
    </div>
  );
}

export default function GeneralInfoPage() {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure your business information."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <GeneralInfoEditor key={business.id} />;
}

function GeneralInfoEditor() {
  const business = useActiveBusiness()!;
  const [form, setForm] = useState<GeneralForm>(() => buildForm(business));
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(buildForm(business)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = buildForm(business);
    setForm(next);
    setSnapshot(JSON.stringify(next));
  }, [business.id]);

  const set = <K extends keyof GeneralForm>(key: K, value: GeneralForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setDay = (day: string, patch: Partial<DaySchedule>) =>
    setForm((f) => ({ ...f, hours: { ...f.hours, [day]: { ...f.hours[day], ...patch } } }));

  const isDirty = JSON.stringify(form) !== snapshot;

  const handleSave = async () => {
    setSaving(true);
    try {
      const contacts: ContactMethod[] = [];
      if (form.phone) contacts.push({ id: "phone", type: "phone", label: "Phone", value: form.phone, enabled: true });
      if (form.email) contacts.push({ id: "email", type: "email", label: "Email", value: form.email, enabled: true });

      updateBusiness(business.id, (draft) => {
        draft.name = form.businessName;
        draft.businessName = form.businessName;
        draft.tagline = form.tagline;
        draft.timezone = form.timezone;
        draft.location = form.address;
        draft.contacts = contacts;
        draft.hours = hoursToBlocks(form.hours);
      });

      await saveLocationConfig({
        location: { ...business, name: form.businessName, businessName: form.businessName, tagline: form.tagline, timezone: form.timezone, location: form.address, contacts, hours: hoursToBlocks(form.hours) },
        assistantConfig: {
          profile: {
            businessName: form.businessName,
            tagline: form.tagline,
            timezone: form.timezone,
            address: form.address,
            phone: form.phone,
            email: form.email,
            website: form.website,
          },
        },
      });
      setSnapshot(JSON.stringify(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">General info</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Your core business identity and contact details. These inform your chatbot's responses.</p>
      </div>

      {/* Business Identity */}
      <SectionCard title="Business Identity">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Business name"
            value={form.businessName}
            onChange={(v) => set("businessName", v)}
            placeholder="Windmill Creek Seafood"
          />
          <TextInput
            label="Tagline"
            value={form.tagline}
            onChange={(v) => set("tagline", v)}
            placeholder="Fresh seafood on the Eastern Shore"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-text)]">Timezone</span>
            <select
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {/* Contact & Location */}
      <SectionCard title="Contact Info">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextInput
              label="Address"
              value={form.address}
              onChange={(v) => set("address", v)}
              placeholder="123 Main Street, City, State 12345"
            />
          </div>
          <TextInput
            label="Phone number"
            value={form.phone}
            onChange={(v) => set("phone", formatPhone(v))}
            placeholder="+1 (555) 000-0000"
          />
          <TextInput
            label="Email"
            value={form.email}
            onChange={(v) => set("email", v)}
            placeholder="hello@mybusiness.com"
          />
          <div className="md:col-span-2 flex items-end gap-3">
            <div className="flex-1">
              <TextInput
                label="Website URL"
                value={form.website}
                onChange={(v) => set("website", v)}
                placeholder="https://www.mybusiness.com"
              />
            </div>
            <Link
              href="/knowledge"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="4.5" /><path d="M12 12l-2.5-2.5" />
              </svg>
              Scan website
            </Link>
          </div>
        </div>
      </SectionCard>

      {/* Operating Hours */}
      <SectionCard title="Operating hours" description="Your chatbot will reference these when customers ask about your hours.">
        <div className="space-y-2.5">
          {DAYS.map((day) => {
            const schedule = form.hours[day];
            return (
              <div key={day} className="flex items-center gap-5 py-0.5">
                <span className={`w-28 shrink-0 text-sm font-medium ${schedule.open ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}`}>{day}</span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={schedule.open}
                  onClick={() => setDay(day, { open: !schedule.open })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${schedule.open ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${schedule.open ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                {schedule.open ? (
                  <>
                    <span className="w-12 shrink-0 text-sm font-medium text-[var(--color-text)]">Open</span>
                    <TimeInput value={schedule.openTime} onChange={(v) => setDay(day, { openTime: v })} />
                    <span className="text-xs font-semibold tracking-widest text-[var(--color-text-secondary)]">TO</span>
                    <TimeInput value={schedule.closeTime} onChange={(v) => setDay(day, { closeTime: v })} />
                  </>
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SaveBar visible={isDirty || saving} onSave={handleSave} saving={saving} />
    </div>
  );
}
