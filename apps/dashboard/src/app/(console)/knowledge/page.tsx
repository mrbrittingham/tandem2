'use client';

import { useEffect, useState } from "react";
import type { FAQItem, PolicyItem } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { WebsiteImportPanel, type ImportedKnowledgePayload } from "@/components/WebsiteImportPanel";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import {
  applyAiSetupPrompt,
  buildKnowledgeProgramFromBusiness,
  hydrateKnowledgeProgram,
  toKnowledgeConfig,
  type KnowledgeProgram,
} from "@/lib/knowledge-program";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

type SourceKind = "menu" | "events" | "policies" | "faq" | "other";

type EntryForm = {
  title: string;
  body: string;
  category: string;
  showInHelp: boolean;
};

const defaultFaqForm: EntryForm = {
  title: "",
  body: "",
  category: "General",
  showInHelp: true,
};

const defaultPolicyForm: EntryForm = {
  title: "",
  body: "",
  category: "Policies",
  showInHelp: true,
};

const sourceKinds: SourceKind[] = ["menu", "events", "policies", "faq", "other"];

export default function KnowledgePage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to train your assistant with restaurant knowledge, events, and policies."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <KnowledgeEditor />;
}

function KnowledgeEditor() {
  const business = useActiveBusiness();
  const [program, setProgram] = useState<KnowledgeProgram | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [faqForm, setFaqForm] = useState<EntryForm>(defaultFaqForm);
  const [policyForm, setPolicyForm] = useState<EntryForm>(defaultPolicyForm);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("other");
  const [saving, setSaving] = useState(false);
  const [applyingPrompt, setApplyingPrompt] = useState(false);

  useEffect(() => {
    if (!business) {
      setProgram(null);
      setInitialSnapshot("");
      return;
    }

    const base = buildKnowledgeProgramFromBusiness(business);
    setProgram(base);
    setInitialSnapshot(JSON.stringify(base));

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
            knowledgeConfig?: Record<string, unknown>;
          };
        };

        const hydrated = hydrateKnowledgeProgram(payload.config?.knowledgeConfig, base);
        setProgram(hydrated);
        setInitialSnapshot(JSON.stringify(hydrated));
      } catch {
        // Keep local defaults if hydration fails.
      }
    };

    void hydrate();
  }, [business]);

  if (!business || !program) {
    return null;
  }

  const isDirty = JSON.stringify(program) !== initialSnapshot;

  const updateField = (key: keyof KnowledgeProgram["fields"], value: string) => {
    setProgram((current) => (current ? { ...current, fields: { ...current.fields, [key]: value } } : current));
  };

  const updateTraining = (key: keyof KnowledgeProgram["training"], value: string | string[]) => {
    setProgram((current) => (current ? { ...current, training: { ...current.training, [key]: value } } : current));
  };

  const addOrUpdateFaq = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!faqForm.title.trim() || !faqForm.body.trim()) {
      return;
    }

    const nextEntry: FAQItem = {
      id: editingFaqId ?? crypto.randomUUID(),
      question: faqForm.title.trim(),
      answer: faqForm.body.trim(),
      category: faqForm.category.trim() || "General",
      showInHelp: faqForm.showInHelp,
      updatedAt: new Date().toISOString(),
    };

    setProgram((current) => {
      if (!current) return current;
      const faqs = editingFaqId
        ? current.faqs.map((item) => (item.id === editingFaqId ? nextEntry : item))
        : [...current.faqs, nextEntry];
      return { ...current, faqs };
    });

    setFaqForm(defaultFaqForm);
    setEditingFaqId(null);
  };

  const addOrUpdatePolicy = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policyForm.title.trim() || !policyForm.body.trim()) {
      return;
    }

    const nextEntry: PolicyItem = {
      id: editingPolicyId ?? crypto.randomUUID(),
      title: policyForm.title.trim(),
      description: policyForm.body.trim(),
      category: policyForm.category.trim() || "Policies",
      showInHelp: policyForm.showInHelp,
      updatedAt: new Date().toISOString(),
    };

    setProgram((current) => {
      if (!current) return current;
      const policies = editingPolicyId
        ? current.policies.map((item) => (item.id === editingPolicyId ? nextEntry : item))
        : [...current.policies, nextEntry];
      return { ...current, policies };
    });

    setPolicyForm(defaultPolicyForm);
    setEditingPolicyId(null);
  };

  const applyPrompt = () => {
    if (!program.setupPrompt.trim()) {
      return;
    }
    setApplyingPrompt(true);
    setProgram((current) => (current ? applyAiSetupPrompt(current, current.setupPrompt) : current));
    setTimeout(() => setApplyingPrompt(false), 350);
  };

  const addSource = () => {
    if (!sourceLabel.trim() || !sourceUrl.trim()) {
      return;
    }

    setProgram((current) => {
      if (!current) return current;
      return {
        ...current,
        uploadedSources: [
          ...current.uploadedSources,
          {
            id: crypto.randomUUID(),
            label: sourceLabel.trim(),
            url: sourceUrl.trim(),
            kind: sourceKind,
          },
        ],
      };
    });

    setSourceLabel("");
    setSourceUrl("");
    setSourceKind("other");
  };

  const applyImportedContent = (payload: ImportedKnowledgePayload) => {
    setProgram((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: {
          ...current.fields,
          businessOverview: payload.shortDescription ?? current.fields.businessOverview,
          locationDetails: payload.address ?? current.fields.locationDetails,
          hours: payload.hours ?? current.fields.hours,
          menuHighlights: payload.insights?.menuSummary ?? current.fields.menuHighlights,
          reservationsGuidance: payload.insights?.reservationGuidance ?? current.fields.reservationsGuidance,
          upcomingEvents: payload.insights?.eventHighlights ?? current.fields.upcomingEvents,
          memberships: payload.insights?.membershipNotes ?? current.fields.memberships,
        },
        importedInsights: {
          eventHighlights: payload.insights?.eventHighlights,
          reservationGuidance: payload.insights?.reservationGuidance,
          membershipNotes: payload.insights?.membershipNotes,
          menuSummary: payload.insights?.menuSummary,
        },
        faqs: payload.faqs.length ? payload.faqs : current.faqs,
        policies: payload.policies.length ? payload.policies : current.policies,
      };
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      updateBusiness(business.id, (draft) => {
        draft.summary = program.fields.businessOverview || draft.summary;
        draft.tagline = program.fields.cuisineServiceStyle || draft.tagline;
        draft.location = program.fields.locationDetails || draft.location;
        draft.faqs = program.faqs;
        draft.policies = program.policies;
        if (program.fields.hours.trim()) {
          draft.handoff.supportHoursLabel = program.fields.hours.trim();
          draft.handoff.statusDetail = program.fields.hours.trim();
        }
      });

      await saveLocationConfig({
        location: business,
        knowledgeConfig: toKnowledgeConfig(program),
        assistantConfig: {
          training: program.training,
          setupPrompt: program.setupPrompt,
        },
      });

      setInitialSnapshot(JSON.stringify(program));
    } finally {
      setSaving(false);
    }
  };

  const visibleFaqs = [...program.faqs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const visiblePolicies = [...program.policies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-10">
      <SectionCard title="AI setup assistant" description="Describe your business in plain language to prefill key knowledge fields.">
        <TextInput
          label="Describe your restaurant, services, and goals"
          multiline
          rows={5}
          value={program.setupPrompt}
          onChange={(value) => setProgram((current) => (current ? { ...current, setupPrompt: value } : current))}
          placeholder="This is a winery restaurant with guided tastings, igloo dining, and live music on weekends. Answer menu questions, promote events, help guests reserve tables, and explain wine club pickup details."
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={applyPrompt} disabled={applyingPrompt || !program.setupPrompt.trim()} className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {applyingPrompt ? "Applying prompt..." : "Apply prompt to setup"}
          </button>
          <p className="text-sm text-slate-600">This updates structured fields, boundaries, and conversion goals. You can edit any result.</p>
        </div>
      </SectionCard>

      <SectionCard title="Structured knowledge" description="Restaurant-first schema designed for clear, practical responses.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Business overview" multiline rows={3} value={program.fields.businessOverview} onChange={(value) => updateField("businessOverview", value)} />
          <TextInput label="Cuisine and service style" multiline rows={3} value={program.fields.cuisineServiceStyle} onChange={(value) => updateField("cuisineServiceStyle", value)} />
          <TextInput label="Hours" multiline rows={3} value={program.fields.hours} onChange={(value) => updateField("hours", value)} />
          <TextInput label="Location details" multiline rows={3} value={program.fields.locationDetails} onChange={(value) => updateField("locationDetails", value)} />
          <TextInput label="Reservations guidance" multiline rows={3} value={program.fields.reservationsGuidance} onChange={(value) => updateField("reservationsGuidance", value)} />
          <TextInput label="Menu highlights" multiline rows={3} value={program.fields.menuHighlights} onChange={(value) => updateField("menuHighlights", value)} />
          <TextInput label="Dietary and allergy notes" multiline rows={3} value={program.fields.dietaryAllergyNotes} onChange={(value) => updateField("dietaryAllergyNotes", value)} />
          <TextInput label="Private events" multiline rows={3} value={program.fields.privateEvents} onChange={(value) => updateField("privateEvents", value)} />
          <TextInput label="Recurring events" multiline rows={3} value={program.fields.recurringEvents} onChange={(value) => updateField("recurringEvents", value)} />
          <TextInput label="Upcoming events" multiline rows={3} value={program.fields.upcomingEvents} onChange={(value) => updateField("upcomingEvents", value)} />
          <TextInput label="Memberships or wine club" multiline rows={3} value={program.fields.memberships} onChange={(value) => updateField("memberships", value)} />
          <TextInput label="Parking and accessibility" multiline rows={3} value={program.fields.parkingAccessibility} onChange={(value) => updateField("parkingAccessibility", value)} />
        </div>
      </SectionCard>

      <SectionCard title="Training controls" description="Define voice, boundaries, escalation rules, and conversion goals.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Tone and voice" multiline rows={3} value={program.training.toneVoice} onChange={(value) => updateTraining("toneVoice", value)} />
          <TextInput label="What the assistant should answer" multiline rows={3} value={program.training.shouldAnswer} onChange={(value) => updateTraining("shouldAnswer", value)} />
          <TextInput label="What the assistant should avoid" multiline rows={3} value={program.training.shouldAvoid} onChange={(value) => updateTraining("shouldAvoid", value)} />
          <TextInput label="Escalation instructions" multiline rows={3} value={program.training.escalationInstructions} onChange={(value) => updateTraining("escalationInstructions", value)} />
          <TextInput
            label="Conversion goals (comma separated)"
            value={program.training.conversionGoals.join(", ")}
            onChange={(value) =>
              updateTraining(
                "conversionGoals",
                value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      </SectionCard>

      <SectionCard title="Uploaded sources" description="Add menu, event, or policy links the assistant should rely on.">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] md:items-end">
          <TextInput label="Label" value={sourceLabel} onChange={setSourceLabel} placeholder="Spring tasting menu" />
          <TextInput label="URL" value={sourceUrl} onChange={setSourceUrl} placeholder="https://example.com/menu" />
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Type</span>
            <select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as SourceKind)} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900">
              {sourceKinds.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addSource} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300">Add source</button>
        </div>

        <div className="mt-4 space-y-2">
          {program.uploadedSources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No sources added yet.</p>
          ) : (
            program.uploadedSources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{source.label}</p>
                  <p className="text-slate-600">{source.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProgram((current) => current ? { ...current, uploadedSources: current.uploadedSources.filter((entry) => entry.id !== source.id) } : current)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-rose-600"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Website crawl and imported intelligence" description="Import website content and merge it into your knowledge program.">
        <WebsiteImportPanel business={business} onApplyImportedContent={applyImportedContent} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="FAQs" description="Customer-ready answers used directly in chat.">
          <form className="space-y-3" onSubmit={addOrUpdateFaq}>
            <TextInput label="Question" value={faqForm.title} onChange={(value) => setFaqForm((current) => ({ ...current, title: value }))} />
            <TextInput label="Answer" multiline rows={4} value={faqForm.body} onChange={(value) => setFaqForm((current) => ({ ...current, body: value }))} />
            <TextInput label="Category" value={faqForm.category} onChange={(value) => setFaqForm((current) => ({ ...current, category: value }))} />
            <ToggleSwitch label="Visible to guests" checked={faqForm.showInHelp} onChange={(next) => setFaqForm((current) => ({ ...current, showInHelp: next }))} />
            <div className="flex justify-end gap-2">
              {editingFaqId ? (
                <button type="button" onClick={() => { setEditingFaqId(null); setFaqForm(defaultFaqForm); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Cancel</button>
              ) : null}
              <button type="submit" className="rounded-xl bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-white">{editingFaqId ? "Update FAQ" : "Add FAQ"}</button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {visibleFaqs.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="font-semibold text-slate-900">{entry.question}</p>
                <p className="mt-1 text-sm text-slate-700">{entry.answer}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Policies" description="Rules and constraints the assistant should cite.">
          <form className="space-y-3" onSubmit={addOrUpdatePolicy}>
            <TextInput label="Title" value={policyForm.title} onChange={(value) => setPolicyForm((current) => ({ ...current, title: value }))} />
            <TextInput label="Details" multiline rows={4} value={policyForm.body} onChange={(value) => setPolicyForm((current) => ({ ...current, body: value }))} />
            <TextInput label="Category" value={policyForm.category} onChange={(value) => setPolicyForm((current) => ({ ...current, category: value }))} />
            <ToggleSwitch label="Visible to guests" checked={policyForm.showInHelp} onChange={(next) => setPolicyForm((current) => ({ ...current, showInHelp: next }))} />
            <div className="flex justify-end gap-2">
              {editingPolicyId ? (
                <button type="button" onClick={() => { setEditingPolicyId(null); setPolicyForm(defaultPolicyForm); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Cancel</button>
              ) : null}
              <button type="submit" className="rounded-xl bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-white">{editingPolicyId ? "Update policy" : "Add policy"}</button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {visiblePolicies.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="font-semibold text-slate-900">{entry.title}</p>
                <p className="mt-1 text-sm text-slate-700">{entry.description}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SaveBar visible={isDirty || saving} onSave={saveAll} saving={saving} />
    </div>
  );
}
