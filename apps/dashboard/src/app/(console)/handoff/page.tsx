'use client';

import { useMemo, useState } from "react";
import { toast } from "@tandem/ui-kit";
import type { BusinessProfile, ContactMethod, HandoffConfig } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";
import { saveLocationConfig } from "@/lib/location-config-client";

function supportState(method: ContactMethod) {
  if (method.type === "phone" || method.type === "email" || method.type === "link") {
    return "Visible to guests";
  }
  return "Internal only";
}

const TYPE_ICONS: Record<ContactMethod["type"], string> = {
  email: "📧",
  phone: "📞",
  sms: "💬",
  link: "🔗",
  form: "📋",
};

const TYPE_EXAMPLES: Record<ContactMethod["type"], string> = {
  email: "e.g. hello@yourrestaurant.com",
  phone: "e.g. (555) 123-4567",
  sms: "e.g. (555) 123-4567",
  link: "e.g. https://yourrestaurant.com/contact",
  form: "e.g. https://yourrestaurant.com/help",
};

export default function HandoffPage() {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure guest-to-team handoff."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <HandoffEditor key={business.id} business={business} />;
}

function HandoffEditor({ business }: { business: BusinessProfile }) {
  const [handoff, setHandoff] = useState<HandoffConfig>(() => JSON.parse(JSON.stringify(business.handoff)) as HandoffConfig);
  const [saving, setSaving] = useState(false);

  const updateField = <Key extends keyof HandoffConfig>(key: Key, value: HandoffConfig[Key]) => {
    setHandoff((prev) => ({ ...prev, [key]: value }));
  };

  const updateContact = (id: string, updates: Partial<ContactMethod>) => {
    setHandoff((prev) => ({
      ...prev,
      contactMethods: prev.contactMethods.map((method) => (method.id === id ? { ...method, ...updates } : method)),
    }));
  };

  const removeContact = (id: string) => {
    setHandoff((prev) => ({
      ...prev,
      contactMethods: prev.contactMethods.filter((method) => method.id !== id),
    }));
  };

  const addContact = () => {
    setHandoff((prev) => ({
      ...prev,
      contactMethods: [
        ...prev.contactMethods,
        {
          id: crypto.randomUUID(),
          type: "email",
          label: "New channel",
          value: "",
          enabled: true,
        },
      ],
    }));
  };

  const enabledCount = useMemo(() => handoff.contactMethods.filter((entry) => entry.enabled).length, [handoff.contactMethods]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      updateBusiness(business.id, (draft) => {
        draft.handoff = handoff;
      });

      await saveLocationConfig({
        location: business,
        handoffConfig: handoff as unknown as Record<string, unknown>,
      });
      toast.success("Handoff settings saved!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSave}>
      {/* Plain-language intro */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤝</span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Connecting guests to your team</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              When a guest needs help that your chatbot can&apos;t provide, it will offer them a way to reach you directly.
              Set up your contact methods below so guests always know how to get in touch.
            </p>
          </div>
        </div>
      </div>
      <SectionCard
        title="When to call for backup"
        description="Set your team's name, availability, and what the chatbot says when no one is available."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] p-4 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          <p className="font-semibold text-[var(--color-text)]">Current status</p>
          <p className="mt-1">{enabledCount > 0 ? `${enabledCount} active contact method${enabledCount === 1 ? "" : "s"}.` : "No contact methods enabled yet."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Handoff title"
            value={handoff.headline}
            onChange={(value) => updateField("headline", value)}
            placeholder="Guest services team"
          />
          <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">Availability</span>
            <select
              value={handoff.status}
              onChange={(event) => updateField("status", event.target.value as HandoffConfig["status"])}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]"
            >
              <option value="online">Online now</option>
              <option value="offline">Offline now</option>
            </select>
          </label>
          <TextInput
            label="Typical response time"
            value={handoff.statusDetail}
            onChange={(value) => updateField("statusDetail", value)}
            placeholder="Replies within 5–10 minutes"
          />
          <TextInput
            label="Support hours"
            value={handoff.supportHoursLabel}
            onChange={(value) => updateField("supportHoursLabel", value)}
            placeholder="Daily 10:00 AM – 10:00 PM"
          />
        </div>

        <TextInput
          label="Offline message"
          multiline
          rows={3}
          value={handoff.offlineMessage}
          onChange={(value) => updateField("offlineMessage", value)}
          placeholder="Thanks for reaching out. Leave your name and best contact method and our team will reply when we are back online."
        />
      </SectionCard>

      <SectionCard
        title="How guests can reach you"
        description="Add one or more ways guests can contact your team. Phone and email show up directly in the chat widget."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
        actions={
          <button
            type="button"
            onClick={addContact}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
          >
            Add method
          </button>
        }
      >
        <div className="space-y-4">
          {handoff.contactMethods.map((method) => (
            <article key={method.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-xs)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TYPE_ICONS[method.type]}</span>
                  <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text)]">{method.label || "Unnamed method"}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[var(--text-xs)] font-semibold ${
                  method.enabled
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                }`}>{method.enabled ? supportState(method) : "Disabled"}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-[140px_1fr_1fr_auto]">
                <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">Type</span>
                  <select
                    value={method.type}
                    onChange={(event) => updateContact(method.id, { type: event.target.value as ContactMethod["type"] })}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)]"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="sms">SMS</option>
                    <option value="link">Link</option>
                    <option value="form">Form</option>
                  </select>
                </label>
                <TextInput label="Label" value={method.label} onChange={(value) => updateContact(method.id, { label: value })} />
                <TextInput
                  label={method.type === "email" ? "Email address" : method.type === "phone" ? "Phone number" : method.type === "sms" ? "SMS number" : method.type === "link" ? "URL" : "Destination"}
                  value={method.value}
                  onChange={(value) => updateContact(method.id, { value })}
                  placeholder={TYPE_EXAMPLES[method.type]}
                />
                <div className="flex flex-col gap-3 text-[var(--text-sm)]">
                  <ToggleSwitch label="Enabled" checked={method.enabled} onChange={(next) => updateContact(method.id, { enabled: next })} />
                  <button
                    type="button"
                    onClick={() => removeContact(method.id)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-xs)] font-medium text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}

          <p className="text-xs text-[var(--color-text-muted)]">
            Tip: Email and phone channels appear directly in the chat widget for guests to use instantly. SMS and form links are also shown when enabled.
          </p>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 1v2M7 11v2M1 7H3M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" />
            </svg>
          )}
          {saving ? "Saving..." : "Save handoff settings"}
        </button>
      </div>
    </form>
  );
}
