'use client';

import { useState } from "react";
import type { BusinessProfile, ContactMethod, HandoffConfig } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

export default function HandoffPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to set how guests reach your team."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <HandoffEditor key={business.id} business={business} />;
}

function HandoffEditor({ business }: { business: BusinessProfile }) {
  const [handoff, setHandoff] = useState<HandoffConfig>(
    () => JSON.parse(JSON.stringify(business.handoff)) as HandoffConfig,
  );

  const updateField = <Key extends keyof HandoffConfig>(key: Key, value: HandoffConfig[Key]) => {
    setHandoff((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateContact = (id: string, updates: Partial<ContactMethod>) => {
    setHandoff((prev) =>
      prev
        ? {
            ...prev,
            contactMethods: prev.contactMethods.map((method) =>
              method.id === id ? { ...method, ...updates } : method,
            ),
          }
        : prev,
    );
  };

  const removeContact = (id: string) => {
    setHandoff((prev) =>
      prev
        ? {
            ...prev,
            contactMethods: prev.contactMethods.filter((method) => method.id !== id),
          }
        : prev,
    );
  };

  const addContact = () => {
    setHandoff((prev) =>
      prev
        ? {
            ...prev,
            contactMethods: [
              ...prev.contactMethods,
              {
                id: crypto.randomUUID(),
                type: "email",
                label: "New channel",
                value: "hello@example.com",
                enabled: true,
              },
            ],
          }
        : prev,
    );
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateBusiness(business.id, (draft) => {
      draft.handoff = handoff;
    });
  };

  return (
    <form className="space-y-8" onSubmit={handleSave}>
      <SectionCard
        title="Handoff"
        description="Set the live support headline, status, and fallback message customers will see."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Support headline"
            value={handoff.headline}
            onChange={(value) => updateField("headline", value)}
            placeholder="Concierge team"
          />
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Status</span>
            <select
              value={handoff.status}
              onChange={(event) => updateField("status", event.target.value as HandoffConfig["status"])}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <TextInput
            label="Response time"
            value={handoff.statusDetail}
            onChange={(value) => updateField("statusDetail", value)}
            placeholder="Replies within 5 minutes"
          />
          <TextInput
            label="Support hours"
            value={handoff.supportHoursLabel}
            onChange={(value) => updateField("supportHoursLabel", value)}
            placeholder="Live daily · 10a-10p PT"
          />
        </div>
        <TextInput
          label="Offline message"
          multiline
          rows={3}
          value={handoff.offlineMessage}
          onChange={(value) => updateField("offlineMessage", value)}
          placeholder="We're away right now but will reply first thing in the morning."
        />
      </SectionCard>

      <SectionCard
        title="Contact methods"
        description="List every way a guest can reach you if they tap Handoff."
        actions={
          <button
            type="button"
            onClick={addContact}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Add method
          </button>
        }
      >
        <div className="space-y-4">
          {handoff.contactMethods.map((method) => (
            <div key={method.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">
              <div className="grid gap-4 md:grid-cols-[140px_1fr_1fr_auto]">
                <label className="flex flex-col gap-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Type</span>
                  <select
                    value={method.type}
                    onChange={(event) => updateContact(method.id, { type: event.target.value as ContactMethod["type"] })}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="sms">SMS</option>
                    <option value="link">Link</option>
                    <option value="form">Form</option>
                  </select>
                </label>
                <TextInput
                  label="Label"
                  value={method.label}
                  onChange={(value) => updateContact(method.id, { label: value })}
                />
                <TextInput
                  label="Value"
                  value={method.value}
                  onChange={(value) => updateContact(method.id, { value })}
                />
                <div className="flex flex-col gap-3 text-sm">
                  <ToggleSwitch
                    label="Live"
                    checked={method.enabled}
                    onChange={(next) => updateContact(method.id, { enabled: next })}
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(method.id)}
                    className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-rose-600 hover:border-rose-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button type="submit" className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
          Save contact settings
        </button>
      </div>
    </form>
  );
}
