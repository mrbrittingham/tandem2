'use client';

import { useState } from "react";
import type { Intent } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";
import { saveLocationConfig } from "@/lib/location-config-client";

const routeOptions = [
  { label: "Answer with FAQs & policies", value: "knowledge" },
  { label: "Open a helpful link", value: "link" },
  { label: "Talk to a person", value: "handoff" },
] as const;

type IntentFormState = {
  label: string;
  description: string;
  prompt: string;
  routeType: Intent["route"]["type"];
  routeHint: string;
};

const defaultIntent: IntentFormState = {
  label: "",
  description: "",
  prompt: "",
  routeType: "knowledge",
  routeHint: "",
};

export default function IntentsPage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();
  const [intentForm, setIntentForm] = useState<IntentFormState>(defaultIntent);
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null);

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Add a location profile to choose what this assistant can help with."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  const persistIntents = (nextIntents: Intent[]) => {
    void saveLocationConfig({
      location: business,
      assistantConfig: {
        intents: nextIntents,
      },
    }).catch(() => {
      // keep local state if remote save fails
    });
  };

  const handleSaveIntent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let updatedIntents: Intent[] = [];
    updateBusiness(business.id, (draft) => {
      if (editingIntentId) {
        const target = draft.intents.find((intent) => intent.id === editingIntentId);
        if (target) {
          target.label = intentForm.label;
          target.description = intentForm.description;
          target.prompt = intentForm.prompt;
          target.route = mapRoute(intentForm);
          target.lastUpdated = new Date().toISOString();
        }
      } else {
        draft.intents.push({
          id: crypto.randomUUID(),
          label: intentForm.label,
          description: intentForm.description,
          prompt: intentForm.prompt,
          route: mapRoute(intentForm),
          lastUpdated: new Date().toISOString(),
        });
      }
      updatedIntents = [...draft.intents];
    });
    persistIntents(updatedIntents);
    setIntentForm(defaultIntent);
    setEditingIntentId(null);
  };

  const removeIntent = (id: string) => {
    let updatedIntents: Intent[] = [];
    updateBusiness(business.id, (draft) => {
      draft.intents = draft.intents.filter((intent) => intent.id !== id);
      updatedIntents = [...draft.intents];
    });
    persistIntents(updatedIntents);
    if (editingIntentId === id) {
      setEditingIntentId(null);
      setIntentForm(defaultIntent);
    }
  };

  const startEdit = (intent: Intent) => {
    setIntentForm({
      label: intent.label,
      description: intent.description,
      prompt: intent.prompt,
      routeType: intent.route.type,
      routeHint: intent.route.type === 'link' ? intent.route.url : intent.route.type === 'handoff' ? intent.route.note ?? '' : '',
    });
    setEditingIntentId(intent.id);
  };

  const moveIntent = (index: number, direction: -1 | 1) => {
    let updatedIntents: Intent[] = [];
    updateBusiness(business.id, (draft) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= draft.intents.length) {
        return;
      }
      const [removed] = draft.intents.splice(index, 1);
      draft.intents.splice(targetIndex, 0, removed);
      updatedIntents = [...draft.intents];
    });
    if (updatedIntents.length) {
      persistIntents(updatedIntents);
    }
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Suggested actions"
        description="Create quick actions that appear above the chat input. Customers tap these to start common conversations."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
        actions={<span className="text-[var(--color-text-muted)]">{business.intents.length} actions</span>}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveIntent}>
          <TextInput
            label="Action label"
            value={intentForm.label}
            onChange={(value) => setIntentForm((prev) => ({ ...prev, label: value }))}
            placeholder="Book a table"
          />
          <TextInput
            label="Short description"
            value={intentForm.description}
            onChange={(value) => setIntentForm((prev) => ({ ...prev, description: value }))}
            placeholder="Reservations, parties, and more"
          />
          <TextInput
            label="Assistant prompt"
            multiline
            rows={3}
            value={intentForm.prompt}
            onChange={(value) => setIntentForm((prev) => ({ ...prev, prompt: value }))}
            placeholder="Act as the Tandem concierge..."
            helperText="Instructions the assistant follows when a customer taps this action."
          />
          <label className="flex flex-col gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">Response type</span>
            <select
              value={intentForm.routeType}
              onChange={(event) =>
                setIntentForm((prev) => ({
                  ...prev,
                  routeType: event.target.value as IntentFormState["routeType"],
                }))
              }
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]"
            >
              {routeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Choose whether the assistant answers, links out, or connects to your team.</span>
          </label>
          {(intentForm.routeType === 'link' || intentForm.routeType === 'handoff') && (
            <TextInput
              label={intentForm.routeType === 'link' ? 'Link to open' : 'Handoff note'}
              value={intentForm.routeHint}
              onChange={(value) => setIntentForm((prev) => ({ ...prev, routeHint: value }))}
              placeholder={intentForm.routeType === 'link' ? 'https://example.com/menu' : 'Send to concierge inbox'}
            />
          )}
          <div className="flex items-center justify-end gap-3 md:col-span-2">
            {editingIntentId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingIntentId(null);
                  setIntentForm(defaultIntent);
                }}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2 text-[var(--text-sm)] font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              {editingIntentId ? "Save action" : "Add action"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Active actions"
        description="Drag to reorder. Most common actions should appear first."
        headerDivider={false}
        headerClassName="mb-3 pb-0"
      >
        {business.intents.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">No actions yet. Add your first one above.</p>
        ) : (
          <div className="space-y-4">
            {business.intents.map((intent, index) => (
              <article
                key={intent.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">{intent.route.type}</p>
                    <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]">{intent.label}</h3>
                    <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{intent.description}</p>
                    <p className="mt-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">Prompt: {intent.prompt}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-[var(--text-sm)]">
                    <button
                      type="button"
                      onClick={() => moveIntent(index, -1)}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === 0}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIntent(index, 1)}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === business.intents.length - 1}
                    >
                      Move down
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-[var(--text-sm)]">
                  <button
                    type="button"
                    onClick={() => startEdit(intent)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIntent(intent.id)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function mapRoute(intent: IntentFormState): Intent["route"] {
  if (intent.routeType === 'link') {
    return { type: 'link', url: intent.routeHint || 'https://example.com' };
  }
  if (intent.routeType === 'handoff') {
    return { type: 'handoff', note: intent.routeHint || 'Route to concierge' };
  }
  return { type: 'knowledge' };
}
