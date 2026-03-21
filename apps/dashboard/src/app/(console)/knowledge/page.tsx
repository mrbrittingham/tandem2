'use client';

import { useEffect, useState } from "react";
import type { FAQItem, PolicyItem } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { WebsiteImportPanel } from "@/components/WebsiteImportPanel";
import type { ImportedKnowledgePayload } from "@/components/WebsiteImportPanel";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { buildKnowledgeProgramFromBusiness, hydrateKnowledgeProgram, toKnowledgeConfig, type KnowledgeProgram } from "@/lib/knowledge-program";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness, useConfigStoreVersion, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";

export default function KnowledgePage({ hideHeader }: { hideHeader?: boolean }) {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to add knowledge for your chatbot."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <KnowledgeEditor key={business.id} hideHeader={hideHeader} />;
}

function KnowledgeEditor({ hideHeader }: { hideHeader?: boolean }) {
  const business = useActiveBusiness()!;
  const configVersion = useConfigStoreVersion();
  const [program, setProgram] = useState<KnowledgeProgram | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);

  const [faqExpanded, setFaqExpanded] = useState<string | null>(null);
  const [faqDraft, setFaqDraft] = useState({ question: "", answer: "", category: "General" });
  const [policyExpanded, setPolicyExpanded] = useState<string | null>(null);
  const [policyDraft, setPolicyDraft] = useState({ title: "", body: "", category: "Policies" });
  const [addingFaq, setAddingFaq] = useState(false);
  const [addingPolicy, setAddingPolicy] = useState(false);

  useEffect(() => {
    setProgram(null);
    const base = buildKnowledgeProgramFromBusiness(business);

    const hydrate = async () => {
      const params = new URLSearchParams();
      params.set("locationId", business.id);
      params.set("locationSlug", business.locationSlug ?? business.slug);
      if (business.businessSlug) params.set("businessSlug", business.businessSlug);
      const r = await fetch(`/api/location-config?${params.toString()}`).catch(() => null);
      const data = r?.ok ? await r.json().catch(() => ({})) as { config?: { knowledgeConfig?: Record<string, unknown> } } : {};
      const hydrated = hydrateKnowledgeProgram((data as { config?: { knowledgeConfig?: Record<string, unknown> } }).config?.knowledgeConfig, base);
      setProgram(hydrated);
      setSnapshot(JSON.stringify(hydrated));
    };
    void hydrate();
    // Re-fetch from server whenever an AI sidebar confirm bumps configVersion.
    // business.id gates location switches; configVersion gates AI confirms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, configVersion]);

  if (!program) return <PageLoader />;

  const isDirty = JSON.stringify(program) !== snapshot;

  const saveAll = async () => {
    setSaving(true);
    try {
      const kc = toKnowledgeConfig(program);
      updateBusiness(business.id, (draft) => {
        draft.faqs = program.faqs;
        draft.policies = program.policies;
      });
      await saveLocationConfig({ location: business, knowledgeConfig: kc as unknown as Record<string, unknown> });
      setSnapshot(JSON.stringify(program));
    } finally {
      setSaving(false);
    }
  };

  const handleImport = (payload: ImportedKnowledgePayload) => {
    setProgram((prev) => {
      if (!prev) return prev;
      const existingFaqIds = new Set(prev.faqs.map((f) => f.id));
      const existingPolicyIds = new Set(prev.policies.map((p) => p.id));
      const merged: KnowledgeProgram = {
        ...prev,
        faqs: [
          ...prev.faqs,
          ...(payload.faqs ?? []).filter((q) => !existingFaqIds.has(q.id ?? "")).map((q) => ({
            id: q.id ?? crypto.randomUUID(),
            question: q.question,
            answer: q.answer,
            category: "Imported",
            showInHelp: true,
            updatedAt: new Date().toISOString(),
          })),
        ],
        policies: [
          ...prev.policies,
          ...(payload.policies ?? []).filter((p) => !existingPolicyIds.has(p.id ?? "")).map((p) => ({
            id: p.id ?? crypto.randomUUID(),
            title: p.title,
            description: p.description ?? "",
            category: "Imported",
            showInHelp: true,
            updatedAt: new Date().toISOString(),
          })),
        ],
        // Sync structured website knowledge so Save preserves imported events/menus/etc.
        structuredWebsiteKnowledge: payload.structured
          ? {
              pageClassification: payload.structured.pageClassification,
              events: payload.structured.events,
              menuSections: payload.structured.menuSections,
              reservations: payload.structured.reservations,
              memberships: payload.structured.memberships,
            }
          : prev.structuredWebsiteKnowledge,
        importedInsights: payload.insights
          ? {
              eventHighlights: payload.insights.eventHighlights,
              reservationGuidance: payload.insights.reservationGuidance,
              membershipNotes: payload.insights.membershipNotes,
              menuSummary: payload.insights.menuSummary,
            }
          : prev.importedInsights,
      };
      return merged;
    });
  };

  const addFaq = () => {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    const entry: FAQItem = {
      id: crypto.randomUUID(),
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim(),
      category: faqDraft.category || "General",
      showInHelp: true,
      updatedAt: new Date().toISOString(),
    };
    setProgram((p) => p ? { ...p, faqs: [...p.faqs, entry] } : p);
    setFaqDraft({ question: "", answer: "", category: "General" });
    setAddingFaq(false);
  };

  const deleteFaq = (id: string) =>
    setProgram((p) => p ? { ...p, faqs: p.faqs.filter((f) => f.id !== id) } : p);

  const updateFaq = (id: string, patch: Partial<FAQItem>) =>
    setProgram((p) => p ? { ...p, faqs: p.faqs.map((f) => f.id === id ? { ...f, ...patch } : f) } : p);

  const addPolicy = () => {
    if (!policyDraft.title.trim() || !policyDraft.body.trim()) return;
    const entry: PolicyItem = {
      id: crypto.randomUUID(),
      title: policyDraft.title.trim(),
      description: policyDraft.body.trim(),
      category: policyDraft.category || "Policies",
      showInHelp: true,
      updatedAt: new Date().toISOString(),
    };
    setProgram((p) => p ? { ...p, policies: [...p.policies, entry] } : p);
    setPolicyDraft({ title: "", body: "", category: "Policies" });
    setAddingPolicy(false);
  };

  const deletePolicy = (id: string) =>
    setProgram((p) => p ? { ...p, policies: p.policies.filter((pl) => pl.id !== id) } : p);

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Knowledge</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Everything your chatbot knows. Import from your website, add Q&amp;A pairs, and manage custom knowledge.</p>
        </div>
      )}

      {/* Website import */}
      <SectionCard title="Import from website" description="Scan your website to automatically pull in menus, hours, FAQs, and more.">
        <WebsiteImportPanel business={business} onApplyImportedContent={handleImport} />
      </SectionCard>

      {/* Q&A */}
      <SectionCard
        title={`Q&A — ${program.faqs.length} question${program.faqs.length === 1 ? "" : "s"}`}
        description="Your chatbot uses these to answer customer questions directly."
        actions={
          <button
            type="button"
            onClick={() => setAddingFaq(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
            Add Q&A
          </button>
        }
      >
        {/* Add form */}
        {addingFaq && (
          <div className="mb-4 rounded-2xl border-2 border-[var(--color-primary)] border-dashed bg-[var(--color-primary-light)] p-4 space-y-3">
            <TextInput label="Question" value={faqDraft.question} onChange={(v) => setFaqDraft((d) => ({ ...d, question: v }))} placeholder="e.g. Do you have gluten-free options?" />
            <TextInput label="Answer" multiline rows={3} value={faqDraft.answer} onChange={(v) => setFaqDraft((d) => ({ ...d, answer: v }))} placeholder="Yes, we offer..." />
            <TextInput label="Category (optional)" value={faqDraft.category} onChange={(v) => setFaqDraft((d) => ({ ...d, category: v }))} placeholder="General" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddingFaq(false)} className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white">Cancel</button>
              <button type="button" onClick={addFaq} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Save Q&A</button>
            </div>
          </div>
        )}

        {program.faqs.length === 0 && !addingFaq ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No Q&A entries yet.</p>
            <button type="button" onClick={() => setAddingFaq(true)} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
              Add your first question
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {program.faqs.map((faq) => (
              <li key={faq.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  onClick={() => setFaqExpanded(faqExpanded === faq.id ? null : faq.id)}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[10px] font-bold text-[var(--color-primary)]">Q</span>
                  <p className="flex-1 text-sm font-medium text-[var(--color-text)]">{faq.question}</p>
                  <svg className={`mt-0.5 shrink-0 transition-transform ${faqExpanded === faq.id ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5l4.5 4.5L11.5 5" /></svg>
                </button>
                {faqExpanded === faq.id && (
                  <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3 space-y-3">
                    <TextInput label="Question" value={faq.question} onChange={(v) => updateFaq(faq.id, { question: v })} />
                    <TextInput label="Answer" multiline rows={3} value={faq.answer} onChange={(v) => updateFaq(faq.id, { answer: v })} />
                    <TextInput label="Category" value={faq.category} onChange={(v) => updateFaq(faq.id, { category: v })} />
                    <div className="flex justify-end">
                      <button type="button" onClick={() => deleteFaq(faq.id)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                {faqExpanded !== faq.id && (
                  <p className="border-t border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg)]">{faq.answer}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Custom knowledge / Policies */}
      <SectionCard
        title={`Custom knowledge — ${program.policies.length} item${program.policies.length === 1 ? "" : "s"}`}
        description="Policies, promotions, allergen info, and other details your chatbot should know."
        actions={
          <button
            type="button"
            onClick={() => setAddingPolicy(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
            Add item
          </button>
        }
      >
        {addingPolicy && (
          <div className="mb-4 rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 space-y-3">
            <TextInput label="Title" value={policyDraft.title} onChange={(v) => setPolicyDraft((d) => ({ ...d, title: v }))} placeholder="e.g. Allergen policy" />
            <TextInput label="Details" multiline rows={3} value={policyDraft.body} onChange={(v) => setPolicyDraft((d) => ({ ...d, body: v }))} placeholder="We take allergens seriously..." />
            <TextInput label="Category" value={policyDraft.category} onChange={(v) => setPolicyDraft((d) => ({ ...d, category: v }))} placeholder="Policies" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddingPolicy(false)} className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white">Cancel</button>
              <button type="button" onClick={addPolicy} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Save item</button>
            </div>
          </div>
        )}

        {program.policies.length === 0 && !addingPolicy ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No custom knowledge yet.</p>
            <button type="button" onClick={() => setAddingPolicy(true)} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
              Add first item
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {program.policies.map((policy) => (
              <li key={policy.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  onClick={() => setPolicyExpanded(policyExpanded === policy.id ? null : policy.id)}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">K</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">{policy.title}</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{policy.category}</p>
                  </div>
                  <svg className={`mt-0.5 shrink-0 transition-transform ${policyExpanded === policy.id ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5l4.5 4.5L11.5 5" /></svg>
                </button>
                {policyExpanded === policy.id ? (
                  <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3 space-y-3">
                    <TextInput label="Title" value={policy.title} onChange={(v) => setProgram((p) => p ? { ...p, policies: p.policies.map((pl) => pl.id === policy.id ? { ...pl, title: v } : pl) } : p)} />
                    <TextInput label="Details" multiline rows={3} value={policy.description} onChange={(v) => setProgram((p) => p ? { ...p, policies: p.policies.map((pl) => pl.id === policy.id ? { ...pl, description: v } : pl) } : p)} />
                    <div className="flex justify-end">
                      <button type="button" onClick={() => deletePolicy(policy.id)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg)] line-clamp-2">{policy.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SaveBar visible={isDirty || saving} onSave={saveAll} saving={saving} />
    </div>
  );
}
