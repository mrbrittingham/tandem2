'use client';

import { useMemo, useState } from "react";
import type { BusinessProfile, ContactMethod, HandoffConfig } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";
import { saveLocationConfig } from "@/lib/location-config-client";

function supportState(method: ContactMethod) {
  if (method.type === "phone" || method.type === "email" || method.type === "link") {
    return "Live in widget";
  }
  return "Saved for internal follow-up";
}

export default function HandoffPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSave}>
      <SectionCard
        title="Handoff overview"
        description="When customers ask for a person, your assistant shows your preferred contact method and a fallback message."
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
        title="Contact methods"
        description="Choose how customers can reach your team when they need a person."
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
                <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text)]">{method.label || "Unnamed method"}</p>
                <span className="rounded-full bg-[var(--color-bg)] px-2 py-1 text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)]">{supportState(method)}</span>
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
                  label={method.type === "email" ? "Email" : method.type === "phone" ? "Phone number" : "Destination"}
                  value={method.value}
                  onChange={(value) => updateContact(method.id, { value })}
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

          <p className="text-xs text-slate-500">
            Note: SMS and form channels are stored and visible to your team. The chat widget currently exposes one primary action to guests.
          </p>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-[var(--console-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save handoff settings"}
        </button>
      </div>
    </form>
  );
}
