'use client';

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

type SettingsForm = {
  businessName: string;
  industry: string;
  timezone: string;
  managerEmail: string;
  notificationEmail: string;
  responseStyle: "concise" | "balanced" | "detailed";
  escalationMode: "smart" | "always_when_uncertain";
  confidenceThreshold: number;
  allowPromoMentions: boolean;
  enableDailyDigest: boolean;
  enableMissedHandoffAlerts: boolean;
  enableImportFailureAlerts: boolean;
  websiteDomain: string;
  embedEnvironment: "production" | "staging";
  requirePublishConfirmation: boolean;
};

function extractEmail(values: Array<{ type: string; value: string; enabled: boolean }>) {
  return values.find((entry) => entry.type === "email" && entry.enabled)?.value ?? "";
}

function initialFromBusiness(business: NonNullable<ReturnType<typeof useActiveBusiness>>): SettingsForm {
  const email = extractEmail(business.contacts);
  return {
    businessName: business.businessName ?? business.name,
    industry: business.industry,
    timezone: business.timezone,
    managerEmail: email,
    notificationEmail: email,
    responseStyle: "balanced",
    escalationMode: "smart",
    confidenceThreshold: 0.62,
    allowPromoMentions: true,
    enableDailyDigest: true,
    enableMissedHandoffAlerts: true,
    enableImportFailureAlerts: true,
    websiteDomain: "",
    embedEnvironment: "production",
    requirePublishConfirmation: false,
  };
}

export default function SettingsPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();
  const [form, setForm] = useState<SettingsForm | null>(business ? initialFromBusiness(business) : null);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!business) {
      setForm(null);
      setInitialSnapshot("");
      return;
    }

    const next = initialFromBusiness(business);
    setForm(next);
    setInitialSnapshot(JSON.stringify(next));

    const hydrate = async () => {
      try {
        const params = new URLSearchParams();
        params.set("locationId", business.id);
        params.set("locationSlug", business.locationSlug ?? business.slug);
        if (business.businessSlug) {
          params.set("businessSlug", business.businessSlug);
        }

        const response = await fetch(`/api/location-config?${params.toString()}`, { method: "GET" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          config?: {
            assistantConfig?: {
              operations?: Partial<SettingsForm>;
              notifications?: Partial<SettingsForm>;
              deployment?: Partial<SettingsForm>;
            };
          };
        };

        const operations = payload.config?.assistantConfig?.operations ?? {};
        const notifications = payload.config?.assistantConfig?.notifications ?? {};
        const deployment = payload.config?.assistantConfig?.deployment ?? {};

        const merged: SettingsForm = {
          ...next,
          responseStyle: operations.responseStyle === "concise" || operations.responseStyle === "detailed" ? operations.responseStyle : next.responseStyle,
          escalationMode: operations.escalationMode === "always_when_uncertain" ? "always_when_uncertain" : next.escalationMode,
          confidenceThreshold: typeof operations.confidenceThreshold === "number" ? operations.confidenceThreshold : next.confidenceThreshold,
          allowPromoMentions: typeof operations.allowPromoMentions === "boolean" ? operations.allowPromoMentions : next.allowPromoMentions,
          enableDailyDigest: typeof notifications.enableDailyDigest === "boolean" ? notifications.enableDailyDigest : next.enableDailyDigest,
          enableMissedHandoffAlerts: typeof notifications.enableMissedHandoffAlerts === "boolean" ? notifications.enableMissedHandoffAlerts : next.enableMissedHandoffAlerts,
          enableImportFailureAlerts: typeof notifications.enableImportFailureAlerts === "boolean" ? notifications.enableImportFailureAlerts : next.enableImportFailureAlerts,
          websiteDomain: typeof deployment.websiteDomain === "string" ? deployment.websiteDomain : next.websiteDomain,
          embedEnvironment: deployment.embedEnvironment === "staging" ? "staging" : next.embedEnvironment,
          requirePublishConfirmation:
            typeof deployment.requirePublishConfirmation === "boolean"
              ? deployment.requirePublishConfirmation
              : next.requirePublishConfirmation,
        };

        setForm(merged);
        setInitialSnapshot(JSON.stringify(merged));
      } catch {
        // Keep local defaults when hydration fails.
      }
    };

    void hydrate();
  }, [business]);

  if (!business || !form) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to manage account defaults, notifications, and deployment settings."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const setupChecks = [
    Boolean(form.businessName.trim()),
    Boolean(form.managerEmail.trim()),
    Boolean(form.websiteDomain.trim()),
    business.handoff.contactMethods.some((entry) => entry.enabled),
    business.faqs.length >= 3,
  ];
  const completion = Math.round((setupChecks.filter(Boolean).length / setupChecks.length) * 100);
  const isDirty = JSON.stringify(form) !== initialSnapshot;

  const handleSave = async () => {
    setSaving(true);
    try {
      updateBusiness(business.id, (draft) => {
        draft.name = form.businessName || draft.name;
        draft.businessName = form.businessName || draft.businessName || draft.name;
        draft.industry = form.industry || draft.industry;
        draft.timezone = form.timezone || draft.timezone;

        const existingEmail = draft.contacts.find((entry) => entry.type === "email");
        if (form.managerEmail.trim()) {
          if (existingEmail) {
            existingEmail.value = form.managerEmail.trim();
            existingEmail.enabled = true;
          } else {
            draft.contacts.push({
              id: crypto.randomUUID(),
              type: "email",
              label: "Manager",
              value: form.managerEmail.trim(),
              enabled: true,
            });
          }
        }
      });

      await saveLocationConfig({
        location: business,
        assistantConfig: {
          operations: {
            responseStyle: form.responseStyle,
            escalationMode: form.escalationMode,
            confidenceThreshold: form.confidenceThreshold,
            allowPromoMentions: form.allowPromoMentions,
          },
          notifications: {
            notificationEmail: form.notificationEmail,
            enableDailyDigest: form.enableDailyDigest,
            enableMissedHandoffAlerts: form.enableMissedHandoffAlerts,
            enableImportFailureAlerts: form.enableImportFailureAlerts,
          },
          deployment: {
            websiteDomain: form.websiteDomain,
            embedEnvironment: form.embedEnvironment,
            requirePublishConfirmation: form.requirePublishConfirmation,
            setupCompletionPercent: completion,
          },
        },
      });

      setInitialSnapshot(JSON.stringify(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Business details"
        description="Core information used across your assistant, widget, and customer interactions."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Business display name" value={form.businessName} onChange={(value) => update("businessName", value)} />
          <TextInput label="Industry" value={form.industry} onChange={(value) => update("industry", value)} placeholder="restaurant" />
          <TextInput label="Timezone" value={form.timezone} onChange={(value) => update("timezone", value)} placeholder="America/Los_Angeles" />
          <TextInput label="Manager email" value={form.managerEmail} onChange={(value) => update("managerEmail", value)} placeholder="owner@example.com" />
        </div>
      </SectionCard>

      <SectionCard
        title="Assistant behavior"
        description="Control how your assistant responds to customers."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">Response style</span>
            <select
              value={form.responseStyle}
              onChange={(event) => update("responseStyle", event.target.value as SettingsForm["responseStyle"])}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">Escalation policy</span>
            <select
              value={form.escalationMode}
              onChange={(event) => update("escalationMode", event.target.value as SettingsForm["escalationMode"])}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]"
            >
              <option value="smart">Escalate when customer requests a person</option>
              <option value="always_when_uncertain">Escalate when uncertain</option>
            </select>
          </label>
          <TextInput
            label="Confidence threshold (0.0–1.0)"
            value={String(form.confidenceThreshold)}
            onChange={(value) => {
              const parsed = Number.parseFloat(value);
              if (!Number.isNaN(parsed)) {
                update("confidenceThreshold", Math.max(0, Math.min(1, parsed)));
              }
            }}
          />
          <ToggleSwitch
            label="Allow promotional mentions"
            helperText="Assistant can mention specials and upcoming events when relevant."
            checked={form.allowPromoMentions}
            onChange={(next) => update("allowPromoMentions", next)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Choose what alerts your team receives."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Notification email"
            value={form.notificationEmail}
            onChange={(value) => update("notificationEmail", value)}
            placeholder="ops@example.com"
          />
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] p-4">
            <ToggleSwitch label="Daily performance digest" checked={form.enableDailyDigest} onChange={(next) => update("enableDailyDigest", next)} />
            <ToggleSwitch label="Missed handoff alerts" checked={form.enableMissedHandoffAlerts} onChange={(next) => update("enableMissedHandoffAlerts", next)} />
            <ToggleSwitch label="Import failure alerts" checked={form.enableImportFailureAlerts} onChange={(next) => update("enableImportFailureAlerts", next)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Website chat installation"
        description="Where your chat widget is installed and who can manage this location."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Website domain" value={form.websiteDomain} onChange={(value) => update("websiteDomain", value)} placeholder="www.example.com" />
          <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">Environment</span>
            <select
              value={form.embedEnvironment}
              onChange={(event) => update("embedEnvironment", event.target.value as SettingsForm["embedEnvironment"])}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
          </label>
        </div>

        <ToggleSwitch
          label="Confirm before publishing major changes"
          helperText="Adds an extra step before applying large knowledge updates."
          checked={form.requirePublishConfirmation}
          onChange={(next) => update("requirePublishConfirmation", next)}
        />

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg)] p-4 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          <p className="font-semibold text-[var(--color-text)]">Team access</p>
          <p className="mt-1">This location is managed by the account owner. Team invitations are coming soon.</p>
        </div>
      </SectionCard>

      <SectionCard
        title="Setup progress"
        description="How complete your location setup is."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500" style={{ width: `${completion}%` }} />
          </div>
          <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text)]">{completion}% complete</p>
        </div>
      </SectionCard>

      <SaveBar visible={isDirty || saving} onSave={handleSave} saving={saving} />
    </div>
  );
}
