"use client";

import { useState, type FormEvent } from "react";

type ManualSetupData = {
  hours: string;
  description: string;
};

type Props = {
  locationId: string;
  businessId: string;
  onSave: (data: ManualSetupData) => void;
  disabled?: boolean;
};

/**
 * Right-panel form for Stage 4 (manual setup fallback).
 * Collects hours and description when website scan is unavailable.
 * Saves directly to PUT /api/location-config.
 * AI tool-calling upgrade deferred to Phase 5.
 */
export function ManualSetupForm({ locationId, businessId, onSave, disabled = false }: Props) {
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInput = hours.trim() || description.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasInput || isSaving || disabled) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/location-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId,
          businessId,
          knowledgeConfig: {
            businessProfile: {
              hours: hours.trim() || undefined,
              shortDescription: description.trim() || undefined,
            },
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to save details");
      }

      onSave({ hours: hours.trim(), description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">
          Manual setup
        </p>
        <p className="mt-1 text-base font-semibold text-[var(--console-text-primary)]">
          Tell me about your restaurant
        </p>
        <p className="mt-1 text-sm text-[var(--console-text-secondary)]">
          Add your hours and a short description. I&apos;ll add them to your chatbot&apos;s knowledge base.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-[var(--console-text-secondary)]">
          <span className="mb-1 block font-medium">Hours</span>
          <textarea
            rows={3}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={isSaving || disabled}
            placeholder="Tuesday through Sunday 11am to 9pm, closed Mondays."
            className="w-full resize-none rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block text-sm text-[var(--console-text-secondary)]">
          <span className="mb-1 block font-medium">Short description (optional)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving || disabled}
            placeholder="A neighborhood Italian restaurant specializing in handmade pasta."
            className="w-full resize-none rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        {error ? (
          <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-sm text-[var(--console-error)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!hasInput || isSaving || disabled}
          className="w-full rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
