'use client';

import { useState } from "react";
import type { Intent } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

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

  const handleSaveIntent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    });
    setIntentForm(defaultIntent);
    setEditingIntentId(null);
  };

  const removeIntent = (id: string) => {
    updateBusiness(business.id, (draft) => {
      draft.intents = draft.intents.filter((intent) => intent.id !== id);
    });
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
    updateBusiness(business.id, (draft) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= draft.intents.length) {
        return;
      }
      const [removed] = draft.intents.splice(index, 1);
      draft.intents.splice(targetIndex, 0, removed);
    });
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Assistant playbook"
        description="Choose what your assistant can help with. These quick actions appear above the chat composer."
        actions={<span className="text-slate-500">{business.intents.length} suggestions</span>}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveIntent}>
          <TextInput
            label="Suggested action"
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
            helperText="We’ll inject this when guests tap the suggestion."
          />
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Response type</span>
            <select
              value={intentForm.routeType}
              onChange={(event) =>
                setIntentForm((prev) => ({
                  ...prev,
                  routeType: event.target.value as IntentFormState["routeType"],
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            >
              {routeOptions.map((option) => (
                <option key={option.value} value={option.value} className="text-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">Choose whether the assistant answers, links out, or escalates.</span>
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
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
              >
                Cancel edit
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              {editingIntentId ? "Save suggested action" : "Add to assistant"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Live assistant menu"
        description="Reorder suggestions to prioritize the most common tasks."
      >
        {business.intents.length === 0 ? (
          <p className="text-sm text-slate-500">No quick actions yet. Add your first assistant task above.</p>
        ) : (
          <div className="space-y-4">
            {business.intents.map((intent, index) => (
              <article
                key={intent.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{intent.route.type}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{intent.label}</h3>
                    <p className="text-sm text-slate-600">{intent.description}</p>
                    <p className="mt-2 text-xs text-slate-500">Prompt: {intent.prompt}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => moveIntent(index, -1)}
                      className="rounded-2xl border border-slate-200 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === 0}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIntent(index, 1)}
                      className="rounded-2xl border border-slate-200 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === business.intents.length - 1}
                    >
                      Move down
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => startEdit(intent)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700 hover:border-slate-300"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIntent(intent.id)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-rose-600 hover:border-rose-200"
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
