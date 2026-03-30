'use client';

import { useEffect, useState } from "react";
import { toast } from "@tandem/ui-kit";
import type { Intent } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { updateBusiness, useActiveBusiness, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";
import { PageLoader } from "@/components/PageLoader";
import { saveLocationConfig } from "@/lib/location-config-client";

const RESPONSE_STYLES = [
  { value: "concise", label: "Concise", desc: "Short, direct answers. Best for quick service." },
  { value: "balanced", label: "Balanced", desc: "Clear and helpful with some detail." },
  { value: "detailed", label: "Detailed", desc: "Thorough explanations. Best for complex services." },
] as const;

type ResponseStyle = "concise" | "balanced" | "detailed";

type Persona = {
  name: string;
  greeting: string;
  responseStyle: ResponseStyle;
};

type IntentFormState = {
  label: string;
  description: string;
  routeType: Intent["route"]["type"];
  routeHint: string;
};

const defaultIntent: IntentFormState = {
  label: "",
  description: "",
  routeType: "knowledge",
  routeHint: "",
};

function mapRoute(form: IntentFormState): Intent["route"] {
  if (form.routeType === "link") return { type: "link", url: form.routeHint || "https://example.com" };
  if (form.routeType === "handoff") return { type: "handoff", note: form.routeHint };
  return { type: "knowledge" };
}

const ROUTE_OPTIONS = [
  { value: "knowledge", label: "Answer from knowledge base", icon: "📚" },
  { value: "link", label: "Open a link", icon: "🔗" },
  { value: "handoff", label: "Route to a person", icon: "🙋" },
] as const;

export default function AssistantPage({ hideHeader }: { hideHeader?: boolean }) {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to configure your AI assistant."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <AssistantEditor key={business.id} hideHeader={hideHeader} />;
}

function AssistantEditor({ hideHeader }: { hideHeader?: boolean }) {
  const business = useActiveBusiness()!;
  const { open: openPreview } = usePreviewDock();
  const [persona, setPersona] = useState<Persona>({ name: "Tandem Assistant", greeting: "Hi! How can I help you today?", responseStyle: "balanced" });
  const [personaSnapshot, setPersonaSnapshot] = useState(JSON.stringify(persona));
  const [savingPersona, setSavingPersona] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [intentForm, setIntentForm] = useState<IntentFormState>(defaultIntent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingIntent, setAddingIntent] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      const params = new URLSearchParams();
      params.set("locationId", business.id);
      params.set("locationSlug", business.locationSlug ?? business.slug);
      if (business.businessSlug) params.set("businessSlug", business.businessSlug);
      const r = await fetch(`/api/location-config?${params.toString()}`).catch(() => null);
      if (r?.ok) {
        const data = await r.json().catch(() => ({})) as { config?: { assistantConfig?: { persona?: Partial<Persona> } } };
        const p = data.config?.assistantConfig?.persona;
        if (p) {
          const merged: Persona = {
            name: p.name ?? persona.name,
            greeting: p.greeting ?? persona.greeting,
            responseStyle: (p.responseStyle as ResponseStyle) ?? persona.responseStyle,
          };
          setPersona(merged);
          setPersonaSnapshot(JSON.stringify(merged));
        }
      }
      setLoaded(true);
    };
    void hydrate();
  }, [business.id]);

  if (!loaded) return <PageLoader />;

  const personaDirty = JSON.stringify(persona) !== personaSnapshot;

  const savePersona = async () => {
    setSavingPersona(true);
    try {
      await saveLocationConfig({ location: business, assistantConfig: { persona } });
      setPersonaSnapshot(JSON.stringify(persona));
      toast.success("Personality saved!");
    } finally {
      setSavingPersona(false);
    }
  };

  const persistIntents = (intents: Intent[]) => {
    void saveLocationConfig({ location: business, assistantConfig: { intents } }).catch(() => null);
  };

  const handleSaveIntent = () => {
    if (!intentForm.label.trim()) return;
    let updated: Intent[] = [];
    updateBusiness(business.id, (draft) => {
      if (editingId) {
        const target = draft.intents.find((i) => i.id === editingId);
        if (target) {
          target.label = intentForm.label;
          target.description = intentForm.description;
          target.route = mapRoute(intentForm);
          target.lastUpdated = new Date().toISOString();
        }
      } else {
        draft.intents.push({
          id: crypto.randomUUID(),
          label: intentForm.label,
          description: intentForm.description,
          prompt: intentForm.label,
          route: mapRoute(intentForm),
          lastUpdated: new Date().toISOString(),
        });
      }
      updated = [...draft.intents];
    });
    persistIntents(updated);
    toast.success(editingId ? "Topic updated!" : "Topic added!");
    setIntentForm(defaultIntent);
    setEditingId(null);
    setAddingIntent(false);
  };

  const removeIntent = (id: string) => {
    let updated: Intent[] = [];
    updateBusiness(business.id, (draft) => {
      draft.intents = draft.intents.filter((i) => i.id !== id);
      updated = [...draft.intents];
    });
    persistIntents(updated);
    if (editingId === id) { setEditingId(null); setIntentForm(defaultIntent); }
  };

  const startEdit = (intent: Intent) => {
    setIntentForm({
      label: intent.label,
      description: intent.description,
      routeType: intent.route.type,
      routeHint: intent.route.type === "link" ? intent.route.url : intent.route.type === "handoff" ? (intent.route.note ?? "") : "",
    });
    setEditingId(intent.id);
    setAddingIntent(true);
  };

  const intents = business.intents ?? [];

  return (
    <div className="space-y-8">
      <div className={`flex items-start ${hideHeader ? "justify-end" : "justify-between"}`}>
        {!hideHeader && (
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">Assistant</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Configure your AI assistant's personality and the topics it can handle.</p>
          </div>
        )}
        <button
          type="button"
          onClick={openPreview}
          className="flex items-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5.5" /><path d="M5.5 5.5 8.5 7l-3 1.5V5.5z" fill="currentColor" />
          </svg>
          Preview chat
        </button>
      </div>

      {/* Persona */}
      <SectionCard title="Your chatbot's personality" description="Choose a name for your assistant, set its greeting, and pick how it communicates with guests.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Assistant name"
              value={persona.name}
              onChange={(v) => setPersona((p) => ({ ...p, name: v }))}
              placeholder="e.g. Wally, Marina, Alex"
            />
            <TextInput
              label="Greeting message"
              value={persona.greeting}
              onChange={(v) => setPersona((p) => ({ ...p, greeting: v }))}
              placeholder="Hi! How can I help you today?"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Response style</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {RESPONSE_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setPersona((p) => ({ ...p, responseStyle: style.value }))}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors ${persona.responseStyle === style.value ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}
                >
                  <p className={`text-sm font-semibold ${persona.responseStyle === style.value ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>{style.label}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {personaDirty && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePersona}
                disabled={savingPersona}
                className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
              >
                {savingPersona ? "Saving…" : "Save persona"}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Topics / Intents */}
      <SectionCard
        title={`What your chatbot handles — ${intents.length} topic${intents.length === 1 ? "" : "s"}`}
        description="Tell your chatbot what common questions to expect and how to respond to each. You can always add more later."
        actions={
          !addingIntent ? (
            <button
              type="button"
              onClick={() => { setIntentForm(defaultIntent); setEditingId(null); setAddingIntent(true); }}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
              Add topic
            </button>
          ) : null
        }
      >
        {/* Add/edit form */}
        {addingIntent && (
          <div className="mb-5 rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-primary)]">{editingId ? "Edit topic" : "New topic"}</h3>
            <TextInput
              label="Topic name"
              value={intentForm.label}
              onChange={(v) => setIntentForm((f) => ({ ...f, label: v }))}
              placeholder="e.g. Reservations, Menu questions, Directions"
            />
            <TextInput
              label="Description (optional)"
              value={intentForm.description}
              onChange={(v) => setIntentForm((f) => ({ ...f, description: v }))}
              placeholder="What should the assistant do when this topic comes up?"
            />
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">When this topic comes up…</p>
              <div className="space-y-2">
                {ROUTE_OPTIONS.map((opt) => (
                  <label key={opt.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${intentForm.routeType === opt.value ? "border-[var(--color-primary)] bg-[var(--color-surface)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}>
                    <input
                      type="radio"
                      className="mt-0.5"
                      checked={intentForm.routeType === opt.value}
                      onChange={() => setIntentForm((f) => ({ ...f, routeType: opt.value as Intent["route"]["type"] }))}
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{opt.icon} {opt.label}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {intentForm.routeType === "link" && (
              <TextInput label="URL" value={intentForm.routeHint} onChange={(v) => setIntentForm((f) => ({ ...f, routeHint: v }))} placeholder="https://example.com/reservations" />
            )}
            {intentForm.routeType === "handoff" && (
              <TextInput label="Handoff note (internal)" value={intentForm.routeHint} onChange={(v) => setIntentForm((f) => ({ ...f, routeHint: v }))} placeholder="Route to reservations team" />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setAddingIntent(false); setEditingId(null); setIntentForm(defaultIntent); }} className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
              <button type="button" onClick={handleSaveIntent} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                {editingId ? "Update topic" : "Add topic"}
              </button>
            </div>
          </div>
        )}

        {intents.length === 0 && !addingIntent ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No topics configured yet.</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Topics help your assistant know what it should handle and how.</p>
            <button type="button" onClick={() => { setIntentForm(defaultIntent); setEditingId(null); setAddingIntent(true); }} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
              Add your first topic
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {intents.map((intent) => {
              const route = intent.route;
              const routeIcon = route.type === "link" ? "🔗" : route.type === "handoff" ? "🙋" : "📚";
              const routeLabel = route.type === "link" ? "Opens a link" : route.type === "handoff" ? "Routes to a person" : "Answers from knowledge";
              return (
                <li key={intent.id} className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-lg">{routeIcon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text)]">{intent.label}</p>
                    {intent.description && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{intent.description}</p>}
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{routeLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => startEdit(intent)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                      Edit
                    </button>
                    <button type="button" onClick={() => removeIntent(intent.id)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-red-600 hover:border-red-300 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
