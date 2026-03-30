'use client';

import { useEffect, useMemo, useState } from "react";
import { toast } from "@tandem/ui-kit";
import type { FAQItem, PolicyItem } from "@tandem/shared";
import { isEventExpired } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TextInput } from "@/components/TextInput";
import { WebsiteImportPanel } from "@/components/WebsiteImportPanel";
import type { ImportedKnowledgePayload } from "@/components/WebsiteImportPanel";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { buildKnowledgeProgramFromBusiness, hydrateKnowledgeProgram, toKnowledgeConfig, type KnowledgeProgram } from "@/lib/knowledge-program";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness, useConfigStoreVersion, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";

// Phase 1 lifecycle fields may be present on events after addEventLifecycle() stamping.
// The legacy KnowledgeProgram type doesn't include them yet — use this extension for display.
type EventWithLifecycle = KnowledgeProgram["structuredWebsiteKnowledge"]["events"][number] & {
  expires_at?: string | null;
  start_at?: string | null;
  first_seen_at?: string;
  last_seen_at?: string;
};

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
  const [menuExpanded, setMenuExpanded] = useState<string | null>(null);

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

  const completeness = useMemo(() => {
    if (!program) return 0;
    let score = 0;
    const sk = program.structuredWebsiteKnowledge;
    if (sk) {
      if (sk.events.length > 0) score += 20;
      if (sk.menuSections.length > 0) score += 20;
      if (sk.reservations.bookingUrl || sk.reservations.instructions) score += 10;
    }
    if (program.faqs.length >= 1) score += 25;
    if (program.policies.length >= 1) score += 25;
    return score;
  }, [program]);

  const completenessHint = useMemo(() => {
    if (!program) return "";
    if (completeness === 100) return "Your chatbot is fully configured!";
    const sk = program.structuredWebsiteKnowledge;
    if (!sk || (sk.events.length === 0 && sk.menuSections.length === 0)) {
      return "Start by scanning your website to auto-fill menus, events, and hours.";
    }
    if (program.policies.length === 0) return "Add a policy (allergen info, group policy, etc.) to complete your setup.";
    if (program.faqs.length === 0) return "Add Q&A pairs to help answer common questions.";
    return "Almost there — keep filling in knowledge.";
  }, [completeness, program]);

  if (!program) return <PageLoader />;

  const isDirty = JSON.stringify(program) !== snapshot;
  const sk = program.structuredWebsiteKnowledge;
  const hasStructuredKnowledge =
    sk.events.length > 0 ||
    sk.menuSections.length > 0 ||
    sk.reservations.bookingUrl ||
    sk.reservations.instructions ||
    sk.memberships.name;

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
      toast.success("Knowledge saved!");
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

      {/* Website scan hero */}
      <div>
        <div className="relative overflow-hidden rounded-2xl bg-[var(--color-primary)] px-8 py-8 text-white">
          <div className="relative z-10">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              ✨ 99% auto-configured
            </span>
            <h2 className="text-2xl font-bold leading-tight">Scan your website to set up your AI in minutes</h2>
            <p className="mt-2 max-w-xl text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>
              We&apos;ll read your menus, hours, FAQs, and contact info — then load it all into your chatbot automatically. Most restaurants are fully configured in under 2 minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-5 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
              <span className="flex items-center gap-1.5">✓ Menus &amp; pricing</span>
              <span className="flex items-center gap-1.5">✓ Hours &amp; location</span>
              <span className="flex items-center gap-1.5">✓ Events &amp; reservations</span>
              <span className="flex items-center gap-1.5">✓ FAQs &amp; policies</span>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="absolute -right-2 bottom-0 h-20 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-white p-6">
          <WebsiteImportPanel business={business} onApplyImportedContent={handleImport} />
        </div>
      </div>

      {/* Knowledge completeness */}
      {completeness < 100 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">Knowledge completeness</p>
              <p className="mt-0.5 text-xs text-amber-700">{completenessHint}</p>
            </div>
            <span className="shrink-0 text-xl font-bold text-amber-600">{completeness}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-200">
            <div className="h-2 rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${completeness}%` }} />
          </div>
        </div>
      )}

      {/* ── STRUCTURED KNOWLEDGE SECTIONS ───────────────────────────────── */}
      {hasStructuredKnowledge && (
        <>
          {/* Events */}
          {sk.events.length > 0 && (
            <SectionCard
              eyebrow="Imported from website"
              title={`Events — ${sk.events.length}`}
              description="Upcoming and recurring events detected from your website. Re-scan to update."
            >
              <ul className="space-y-3">
                {(sk.events as EventWithLifecycle[]).map((event) => {
                  const expired = event.expires_at
                    ? isEventExpired({ expires_at: event.expires_at })
                    : false;
                  return (
                    <li key={event.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                      <div className="flex flex-wrap items-start gap-2">
                        <p className="flex-1 text-sm font-semibold text-[var(--color-text)]">{event.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {event.recurring && <StatusBadge label="Recurring" tone="info" />}
                          {expired ? (
                            <StatusBadge label="Expired" tone="warning" />
                          ) : event.date ? (
                            <StatusBadge label={event.date} tone="success" />
                          ) : null}
                        </div>
                      </div>
                      {event.description && (
                        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{event.description}</p>
                      )}
                      {(event.time || event.bookingInfo) && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                          {event.time && <span>⏱ {event.time}</span>}
                          {event.bookingInfo && <span>🎟 {event.bookingInfo}</span>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {/* Menu */}
          {sk.menuSections.length > 0 && (
            <SectionCard
              eyebrow="Imported from website"
              title={`Menu — ${sk.menuSections.reduce((acc, s) => acc + s.items.length, 0)} items across ${sk.menuSections.length} section${sk.menuSections.length === 1 ? "" : "s"}`}
              description="Your menu as imported from your website. Re-scan to update."
            >
              <ul className="space-y-2">
                {sk.menuSections.map((section) => (
                  <li key={section.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setMenuExpanded(menuExpanded === section.id ? null : section.id)}
                    >
                      <span className="flex-1 text-sm font-semibold text-[var(--color-text)]">{section.title}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{section.items.length} item{section.items.length === 1 ? "" : "s"}</span>
                      <svg className={`shrink-0 transition-transform ${menuExpanded === section.id ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 5l4.5 4.5L11.5 5" />
                      </svg>
                    </button>
                    {menuExpanded === section.id && (
                      <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                        {section.items.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
                              {item.description && (
                                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{item.description}</p>
                              )}
                              {item.dietaryNotes && (
                                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{item.dietaryNotes}</p>
                              )}
                            </div>
                            {item.price && (
                              <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">{item.price}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Reservations */}
          {(sk.reservations.bookingUrl || sk.reservations.instructions) && (
            <SectionCard
              eyebrow="Imported from website"
              title="Reservations"
              description="Booking details detected from your website."
            >
              <dl className="space-y-3 text-sm">
                {sk.reservations.platforms.length > 0 && (
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Platform</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {sk.reservations.platforms.map((p) => (
                        <StatusBadge key={p} label={p} tone="info" />
                      ))}
                    </dd>
                  </div>
                )}
                {sk.reservations.instructions && (
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Instructions</dt>
                    <dd className="text-sm text-[var(--color-text)]">{sk.reservations.instructions}</dd>
                  </div>
                )}
                {sk.reservations.bookingUrl && (
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Booking URL</dt>
                    <dd>
                      <a href={sk.reservations.bookingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-[var(--color-primary)] underline decoration-dashed hover:decoration-solid">
                        {sk.reservations.bookingUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {sk.reservations.partySizeNotes && (
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Party size</dt>
                    <dd className="text-sm text-[var(--color-text)]">{sk.reservations.partySizeNotes}</dd>
                  </div>
                )}
                {sk.reservations.depositPolicy && (
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Deposit</dt>
                    <dd className="text-sm text-[var(--color-text)]">{sk.reservations.depositPolicy}</dd>
                  </div>
                )}
              </dl>
            </SectionCard>
          )}
        </>
      )}

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
