'use client';

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ColorPicker } from "@/components/ColorPicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { SaveBar } from "@/components/SaveBar";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

export default function BrandingPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();
  const [form, setForm] = useState(() => ({
    businessName: business?.businessName ?? business?.name ?? "",
    industry: business?.industry ?? "",
    logoLabel: business?.theme.logoUrl ?? "",
    primaryColor: business?.theme.primaryColor ?? "#2563EB",
    secondaryColor: business?.theme.accentColor ?? "#0EA5E9",
    welcomeMessage: business?.summary ?? "",
    assistantName: business?.handoff.headline ?? "Assistant",
    widgetPosition: "bottom-right" as "bottom-right" | "bottom-left",
    prefersDark: true,
  }));
  const [saving, setSaving] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(form));

  useEffect(() => {
    if (!business) {
      return;
    }
    const next = {
      businessName: business.businessName ?? business.name,
      industry: business.industry,
      logoLabel: business.theme.logoUrl ?? "",
      primaryColor: business.theme.primaryColor,
      secondaryColor: business.theme.accentColor,
      welcomeMessage: business.summary,
      assistantName: business.handoff.headline,
      widgetPosition: "bottom-right" as const,
      prefersDark: true,
    };
    setForm(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [business]);

  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot]);

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure branding and assistant defaults."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const update = <Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoChange = () => {
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
    update("logoLabel", `uploaded-logo-${timestamp}.png`);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      updateBusiness(business.id, (draft) => {
        draft.theme.primaryColor = form.primaryColor;
        draft.theme.accentColor = form.secondaryColor;
        draft.theme.logoUrl = form.logoLabel || undefined;
        draft.summary = form.welcomeMessage;
        draft.handoff.headline = form.assistantName;
      });
      setInitialSnapshot(JSON.stringify(form));
      setSaving(false);
    }, 800);
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Branding"
        description="Control how your concierge shows up across the widget and dashboard."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Business name"
            value={form.businessName}
            onChange={(value) => update("businessName", value)}
            placeholder="Tandem Concierge"
          />
          <TextInput
            label="Industry"
            value={form.industry}
            onChange={(value) => update("industry", value)}
            placeholder="Hospitality"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
            <p className="text-slate-800">Logo upload</p>
            <p className="mt-2 text-xs text-slate-500">{form.logoLabel}</p>
            <button
              type="button"
              onClick={handleLogoChange}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
            >
              Upload placeholder
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorPicker
              label="Primary color"
              value={form.primaryColor}
              onChange={(value) => update("primaryColor", value)}
            />
            <ColorPicker
              label="Secondary color"
              value={form.secondaryColor}
              onChange={(value) => update("secondaryColor", value)}
            />
          </div>
        </div>
        <TextInput
          label="Welcome message"
          multiline
          rows={4}
          value={form.welcomeMessage}
          onChange={(value) => update("welcomeMessage", value)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Assistant display name"
            value={form.assistantName}
            onChange={(value) => update("assistantName", value)}
          />
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Widget position</span>
            <select
              value={form.widgetPosition}
              onChange={(event) => update("widgetPosition", event.target.value as "bottom-right" | "bottom-left")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            >
              <option value="bottom-right" className="bg-white text-slate-900">
                Bottom right
              </option>
              <option value="bottom-left" className="bg-white text-slate-900">
                Bottom left
              </option>
            </select>
          </label>
        </div>
        <ToggleSwitch
          label="Dark mode default"
          checked={form.prefersDark}
          onChange={(next) => update("prefersDark", next)}
          helperText="Determines the concierge surface theme when embedded."
        />
      </SectionCard>
      <SaveBar visible={isDirty || saving} onSave={handleSave} saving={saving} />
    </div>
  );
}
