'use client';

// ── KNOWLEDGE PAGE — Phase 2: Structured editing interface ──────────────────
// All structured sections (Profile, Events, Menu, Reservations, Policies) are
// now PRIMARY and directly editable. FAQ is demoted to legacy fallback.
// TODO: Replace logo/image URL inputs with upload UI when asset endpoint ready.

import { useEffect, useState } from "react";
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
import {
  buildKnowledgeProgramFromBusiness,
  hydrateKnowledgeProgram,
  toKnowledgeConfig,
  type KnowledgeProgram,
  type KnowledgeScanSuggestion,
  type StructuredEvent,
  type StructuredMenuSection,
  type StructuredMenuItem,
} from "@/lib/knowledge-program";
import { saveLocationConfig } from "@/lib/location-config-client";
import { updateBusiness, useActiveBusiness, useConfigStoreVersion, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";

// Phase 1 lifecycle fields may be present on events after addEventLifecycle() stamping.
type EventWithLifecycle = StructuredEvent & {
  expires_at?: string | null;
  start_at?: string | null;
  first_seen_at?: string;
  last_seen_at?: string;
};

// ── Shared helpers ─────────────────────────────────────────────────────────

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 1v10M1 6h10" />
      </svg>
      {label}
    </button>
  );
}

function EditIconButton({ onClick, title = "Edit" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
    >
      Edit
    </button>
  );
}

function DeleteIconButton({ onClick, title = "Delete" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
    >
      Delete
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5l4.5 4.5L11.5 5" />
    </svg>
  );
}

// ── Root page wrapper ──────────────────────────────────────────────────────

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, configVersion]);


  if (!program) return <PageLoader />;

  const isDirty = JSON.stringify(program) !== snapshot;
  const sk = program.structuredWebsiteKnowledge;
  const hasStructuredKnowledge =
    sk.events.length > 0 ||
    sk.menuSections.length > 0 ||
    !!sk.reservations.bookingUrl ||
    !!sk.reservations.instructions;

  const saveAll = async () => {
    setSaving(true);
    try {
      const kc = toKnowledgeConfig(program);
      updateBusiness(business.id, (draft) => {
        draft.faqs = program.faqs;
        draft.policies = program.policies;
        if (program.businessProfile.logoUrl) {
          draft.theme = { ...draft.theme, logoUrl: program.businessProfile.logoUrl };
        }
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

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Knowledge</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Everything your chatbot knows. Edit your menu, events, and business info directly — or scan your website to auto-fill.
          </p>
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
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <WebsiteImportPanel business={business} onApplyImportedContent={handleImport} />
        </div>
      </div>

      {/* ── PRIMARY: Business Profile ────────────────────────────────────── */}
      <BusinessProfileSection program={program} setProgram={setProgram} />

      {/* ── Suggested Updates (if any pending) ───────────────────────────── */}
      {program.scanSuggestions.filter((s) => s.decision === "pending").length > 0 && (
        <SuggestionsSection program={program} setProgram={setProgram} />
      )}

      {/* ── PRIMARY: Structured sections ─────────────────────────────────── */}
      <EventsSection program={program} setProgram={setProgram} />
      <MenuSection program={program} setProgram={setProgram} />
      <ReservationsSection program={program} setProgram={setProgram} hasStructuredKnowledge={hasStructuredKnowledge} />
      <PoliciesSection program={program} setProgram={setProgram} />

      {/* ── LEGACY: FAQ — secondary / fallback ───────────────────────────── */}
      <LegacyFaqSection program={program} setProgram={setProgram} />

      <SaveBar visible={isDirty || saving} onSave={saveAll} saving={saving} />
    </div>
  );
}

// ── Business Profile Section ───────────────────────────────────────────────

function BusinessProfileSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(program.businessProfile);

  const bp = program.businessProfile;
  const hasAny = bp.name || bp.phone || bp.address || bp.website || bp.logoUrl;

  const saveDraft = () => {
    setProgram((p) => p ? { ...p, businessProfile: { ...draft } } : p);
    setEditing(false);
  };

  const cancelDraft = () => {
    setDraft(program.businessProfile);
    setEditing(false);
  };

  return (
    <SectionCard
      title="Business Details"
      description="Name, contact, address, and logo — shown in your widget header and used for chatbot greetings."
      actions={!editing ? <EditIconButton onClick={() => { setDraft(program.businessProfile); setEditing(true); }} /> : undefined}
    >
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Business name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="e.g. The Oak Room" />
            <TextInput label="Phone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="e.g. (555) 123-4567" type="tel" />
          </div>
          <TextInput label="Address" value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} placeholder="e.g. 123 Main St, Springfield, IL 62701" />
          <TextInput label="Website" value={draft.website} onChange={(v) => setDraft((d) => ({ ...d, website: v }))} placeholder="https://yourrestaurant.com" type="url" />

          {/* Logo */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Logo</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Your logo appears in the chat widget header.
                </p>
              </div>
              {draft.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt="Logo preview" className="h-14 w-14 rounded-xl border border-[var(--color-border)] object-contain bg-white p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            {/* Upload scaffold — TODO: replace button with real upload when asset endpoint is ready */}
            <button
              type="button"
              disabled
              title="Upload support coming soon"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)] cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1v8M4 4l3-3 3 3" />
                <path d="M1.5 10v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />
              </svg>
              Upload logo
              <span className="rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">Coming soon</span>
            </button>
            <div>
              <p className="mb-1.5 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium">Or paste a URL</p>
              <TextInput label="Logo URL" value={draft.logoUrl} onChange={(v) => setDraft((d) => ({ ...d, logoUrl: v }))} placeholder="https://cdn.yoursite.com/logo.png" type="url" helperText="Recommended: 512×512px or larger · PNG or SVG · Transparent background" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={cancelDraft} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={saveDraft} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Apply</button>
          </div>
        </div>
      ) : hasAny ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {bp.name && (
            <div>
              <dt className="text-xs font-medium text-[var(--color-text-muted)]">Business name</dt>
              <dd className="mt-0.5 font-medium text-[var(--color-text)]">{bp.name}</dd>
            </div>
          )}
          {bp.phone && (
            <div>
              <dt className="text-xs font-medium text-[var(--color-text-muted)]">Phone</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{bp.phone}</dd>
            </div>
          )}
          {bp.address && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-[var(--color-text-muted)]">Address</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{bp.address}</dd>
            </div>
          )}
          {bp.website && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-[var(--color-text-muted)]">Website</dt>
              <dd className="mt-0.5">
                <a href={bp.website} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--color-primary)] underline decoration-dashed hover:decoration-solid">{bp.website}</a>
              </dd>
            </div>
          )}
          {bp.logoUrl && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-[var(--color-text-muted)]">Logo</dt>
              <dd className="mt-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bp.logoUrl} alt="Business logo" className="h-14 w-14 rounded-xl border border-[var(--color-border)] object-contain bg-white p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No profile info yet.</p>
          <button type="button" onClick={() => { setDraft(program.businessProfile); setEditing(true); }} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
            Add business profile
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Suggested Updates Section ──────────────────────────────────────────────

function SuggestionsSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const pending = program.scanSuggestions.filter((s) => s.decision === "pending");

  const decide = (id: string, decision: KnowledgeScanSuggestion["decision"]) => {
    setProgram((p) =>
      p ? { ...p, scanSuggestions: p.scanSuggestions.map((s) => (s.id === id ? { ...s, decision } : s)) } : p
    );
  };

  if (!pending.length) return null;

  const CATEGORY_ICONS: Record<string, string> = {
    events: "📅", menu: "🍽️", hours: "⏰", reservations: "📞",
    policies: "📋", business_profile: "🏢", contact: "📍", location: "📍",
  };

  return (
    <SectionCard
      eyebrow="Auto-detected"
      title={`Suggested Updates — ${pending.length}`}
      description="New information from your latest website scan. Review and accept or ignore each suggestion."
    >
      <ul className="space-y-2">
        {pending.map((suggestion) => (
          <li key={suggestion.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-lg" aria-hidden>{CATEGORY_ICONS[suggestion.category] ?? "💡"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">{suggestion.summary}</p>
              {suggestion.detail && <p className="mt-0.5 text-xs text-amber-700">{suggestion.detail}</p>}
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-600">{suggestion.category}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => decide(suggestion.id, "accepted")} className="rounded-lg bg-[var(--color-success)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity">Accept</button>
              <button type="button" onClick={() => decide(suggestion.id, "rejected")} className="rounded-lg border border-amber-200 bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors">Ignore</button>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ── Events Section ─────────────────────────────────────────────────────────

function EventsSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const events = program.structuredWebsiteKnowledge.events as EventWithLifecycle[];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: "", date: "", time: "", description: "", bookingInfo: "", recurring: false });

  const updateEvent = (id: string, patch: Partial<StructuredEvent>) =>
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, events: p.structuredWebsiteKnowledge.events.map((e) => e.id === id ? { ...e, ...patch } : e) } } : p
    );

  const deleteEvent = (id: string) => {
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, events: p.structuredWebsiteKnowledge.events.filter((e) => e.id !== id) } } : p
    );
    if (expandedId === id) setExpandedId(null);
  };

  const addEvent = () => {
    if (!eventDraft.title.trim()) return;
    const newEvent: StructuredEvent = {
      id: crypto.randomUUID(),
      title: eventDraft.title.trim(),
      date: eventDraft.date || null,
      time: eventDraft.time || null,
      description: eventDraft.description.trim(),
      category: "General",
      bookingInfo: eventDraft.bookingInfo.trim() || null,
      sourceUrl: null,
      recurring: eventDraft.recurring,
    };
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, events: [...p.structuredWebsiteKnowledge.events, newEvent] } } : p
    );
    setEventDraft({ title: "", date: "", time: "", description: "", bookingInfo: "", recurring: false });
    setAddingEvent(false);
  };

  return (
    <SectionCard
      title={`Events \u2014 ${events.length}`}
      description="Upcoming and recurring events your chatbot will share with guests. Expired events are not shown to guests."
      actions={<AddButton label="Add event" onClick={() => setAddingEvent(true)} />}
    >
      {addingEvent && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text)]">New event</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextInput label="Title" value={eventDraft.title} onChange={(v) => setEventDraft((d) => ({ ...d, title: v }))} placeholder="e.g. Live Jazz Night" />
            </div>
            <TextInput label="Date" value={eventDraft.date} onChange={(v) => setEventDraft((d) => ({ ...d, date: v }))} placeholder="e.g. March 15, 2026" />
            <TextInput label="Time" value={eventDraft.time} onChange={(v) => setEventDraft((d) => ({ ...d, time: v }))} placeholder="e.g. 7:00 PM" />
          </div>
          <TextInput label="Description" multiline rows={2} value={eventDraft.description} onChange={(v) => setEventDraft((d) => ({ ...d, description: v }))} placeholder="Brief description for your guests..." />
          <TextInput label="Booking link or info" value={eventDraft.bookingInfo} onChange={(v) => setEventDraft((d) => ({ ...d, bookingInfo: v }))} placeholder="https://tickets.com/event or 'Call to reserve'" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={eventDraft.recurring} onChange={(e) => setEventDraft((d) => ({ ...d, recurring: e.target.checked }))} className="h-4 w-4 rounded border-[var(--color-border)]" />
            Recurring event
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddingEvent(false)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={addEvent} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Add event</button>
          </div>
        </div>
      )}

      {events.length === 0 && !addingEvent ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No events yet. Scan your website or add manually.</p>
          <button type="button" onClick={() => setAddingEvent(true)} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">Add first event</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const expired = event.expires_at ? isEventExpired({ expires_at: event.expires_at }) : false;
            const isOpen = expandedId === event.id;
            return (
              <li key={event.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors" onClick={() => setExpandedId(isOpen ? null : event.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text)]">{event.title}</p>
                      {event.recurring && <StatusBadge label="Recurring" tone="info" />}
                      {expired ? <StatusBadge label="Expired" tone="warning" /> : event.date ? <StatusBadge label={event.date} tone="success" /> : null}
                    </div>
                    {event.description && !isOpen && <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{event.description}</p>}
                  </div>
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <TextInput label="Title" value={event.title} onChange={(v) => updateEvent(event.id, { title: v })} />
                      </div>
                      <TextInput label="Date" value={event.date ?? ""} onChange={(v) => updateEvent(event.id, { date: v || null })} placeholder="e.g. March 15, 2026" />
                      <TextInput label="Time" value={event.time ?? ""} onChange={(v) => updateEvent(event.id, { time: v || null })} placeholder="e.g. 7:00 PM" />
                    </div>
                    <TextInput label="Description" multiline rows={2} value={event.description} onChange={(v) => updateEvent(event.id, { description: v })} />
                    <TextInput label="Booking link or info" value={event.bookingInfo ?? ""} onChange={(v) => updateEvent(event.id, { bookingInfo: v || null })} placeholder="https://... or booking instructions" />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" checked={event.recurring} onChange={(e) => updateEvent(event.id, { recurring: e.target.checked })} className="h-4 w-4 rounded border-[var(--color-border)]" />
                      Recurring event
                    </label>
                    <div className="flex justify-between">
                      <DeleteIconButton onClick={() => deleteEvent(event.id)} title="Delete event" />
                      <button type="button" onClick={() => setExpandedId(null)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Done</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Menu Section ───────────────────────────────────────────────────────────

function MenuSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const sections = program.structuredWebsiteKnowledge.menuSections;
  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [itemDraft, setItemDraft] = useState({ name: "", description: "", price: "", imageUrl: "" });
  const [sectionDraft, setSectionDraft] = useState({ title: "" });

  const updateSection = (sectionId: string, patch: Partial<StructuredMenuSection>) =>
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: p.structuredWebsiteKnowledge.menuSections.map((s) => s.id === sectionId ? { ...s, ...patch } : s) } } : p
    );

  const deleteSection = (sectionId: string) => {
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: p.structuredWebsiteKnowledge.menuSections.filter((s) => s.id !== sectionId) } } : p
    );
    if (expandedSection === sectionId) setExpandedSection(null);
  };

  const addSection = () => {
    if (!sectionDraft.title.trim()) return;
    const newSection: StructuredMenuSection = { id: crypto.randomUUID(), title: sectionDraft.title.trim(), sourceUrl: null, items: [] };
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: [...p.structuredWebsiteKnowledge.menuSections, newSection] } } : p
    );
    setSectionDraft({ title: "" });
    setAddingSection(false);
    setExpandedSection(newSection.id);
  };

  const updateItem = (sectionId: string, itemId: string, patch: Partial<StructuredMenuItem>) =>
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: p.structuredWebsiteKnowledge.menuSections.map((s) => s.id === sectionId ? { ...s, items: s.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) } : s) } } : p
    );

  const deleteItem = (sectionId: string, itemId: string) => {
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: p.structuredWebsiteKnowledge.menuSections.map((s) => s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s) } } : p
    );
    if (editingItem?.itemId === itemId) setEditingItem(null);
  };

  const addItem = (sectionId: string) => {
    if (!itemDraft.name.trim()) return;
    const newItem: StructuredMenuItem = {
      id: crypto.randomUUID(),
      name: itemDraft.name.trim(),
      description: itemDraft.description.trim(),
      price: itemDraft.price.trim() || null,
      dietaryNotes: null,
      imageUrl: itemDraft.imageUrl.trim() || null,
    };
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, menuSections: p.structuredWebsiteKnowledge.menuSections.map((s) => s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s) } } : p
    );
    setItemDraft({ name: "", description: "", price: "", imageUrl: "" });
    setAddingItemId(null);
  };

  return (
    <SectionCard
      title={`Menu \u2014 ${totalItems} item${totalItems === 1 ? "" : "s"} across ${sections.length} section${sections.length === 1 ? "" : "s"}`}
      description="Edit menu sections and items directly. Attach images by pasting an image URL."
      actions={<AddButton label="Add section" onClick={() => setAddingSection(true)} />}
    >
      {addingSection && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 space-y-3">
          <TextInput label="Section name" value={sectionDraft.title} onChange={(v) => setSectionDraft({ title: v })} placeholder="e.g. Starters, Mains, Desserts" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddingSection(false)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={addSection} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Add section</button>
          </div>
        </div>
      )}

      {sections.length === 0 && !addingSection ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No menu yet. Scan your website or add sections manually.</p>
          <button type="button" onClick={() => setAddingSection(true)} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">Add first section</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sections.map((section) => {
            const isOpen = expandedSection === section.id;
            return (
              <li key={section.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                {/* Section header row */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setExpandedSection(isOpen ? null : section.id)}>
                    <span className="flex-1 text-sm font-semibold text-[var(--color-text)]">{section.title}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{section.items.length} item{section.items.length === 1 ? "" : "s"}</span>
                    <ChevronIcon open={isOpen} />
                  </button>
                  <DeleteIconButton onClick={() => deleteSection(section.id)} title="Delete section" />
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)]">
                    {/* Editable section title */}
                    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
                      <TextInput label="Section name" value={section.title} onChange={(v) => updateSection(section.id, { title: v })} placeholder="Section name" />
                    </div>

                    {/* Items */}
                    {section.items.map((item) => {
                      const isEditingThis = editingItem?.sectionId === section.id && editingItem?.itemId === item.id;
                      return (
                        <div key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                          {isEditingThis ? (
                            <div className="bg-[var(--color-bg)] px-4 py-3 space-y-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2"><TextInput label="Item name" value={item.name} onChange={(v) => updateItem(section.id, item.id, { name: v })} /></div>
                                <TextInput label="Price" value={item.price ?? ""} onChange={(v) => updateItem(section.id, item.id, { price: v || null })} placeholder="e.g. $14" />
                                <TextInput label="Dietary notes" value={item.dietaryNotes ?? ""} onChange={(v) => updateItem(section.id, item.id, { dietaryNotes: v || null })} placeholder="GF, V, etc." />
                              </div>
                              <TextInput label="Description" multiline rows={2} value={item.description} onChange={(v) => updateItem(section.id, item.id, { description: v })} />
                              <div className="space-y-2">
                                {item.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded-lg border border-[var(--color-border)] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                )}
                                <TextInput label="Image URL" value={item.imageUrl ?? ""} onChange={(v) => updateItem(section.id, item.id, { imageUrl: v || null })} placeholder="https://cdn.site.com/dish.jpg" type="url" helperText="Paste an image URL for this dish. Upload support coming soon." />
                                {/* TODO: replace with upload UI */}
                              </div>
                              <div className="flex justify-between">
                                <DeleteIconButton onClick={() => deleteItem(section.id, item.id)} />
                                <button type="button" onClick={() => setEditingItem(null)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Done</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors">
                              {item.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.imageUrl} alt={item.name} className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-[var(--color-border)] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
                                {item.description && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-secondary)]">{item.description}</p>}
                                {item.dietaryNotes && <p className="text-[11px] text-[var(--color-text-muted)]">{item.dietaryNotes}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {item.price && <span className="text-sm font-semibold text-[var(--color-text)]">{item.price}</span>}
                                <EditIconButton onClick={() => setEditingItem({ sectionId: section.id, itemId: item.id })} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add item form / button */}
                    {addingItemId === section.id ? (
                      <div className="border-t border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-3 space-y-3">
                        <p className="text-xs font-semibold text-[var(--color-text)]">New item</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2"><TextInput label="Item name" value={itemDraft.name} onChange={(v) => setItemDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Grilled Salmon" /></div>
                          <TextInput label="Price" value={itemDraft.price} onChange={(v) => setItemDraft((d) => ({ ...d, price: v }))} placeholder="e.g. $22" />
                          <TextInput label="Image URL (optional)" value={itemDraft.imageUrl} onChange={(v) => setItemDraft((d) => ({ ...d, imageUrl: v }))} placeholder="https://..." type="url" />
                        </div>
                        <TextInput label="Description" multiline rows={2} value={itemDraft.description} onChange={(v) => setItemDraft((d) => ({ ...d, description: v }))} placeholder="Brief description..." />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setAddingItemId(null); setItemDraft({ name: "", description: "", price: "", imageUrl: "" }); }} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
                          <button type="button" onClick={() => addItem(section.id)} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Add item</button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-[var(--color-border)] px-4 py-2.5">
                        <button type="button" onClick={() => { setAddingItemId(section.id); setItemDraft({ name: "", description: "", price: "", imageUrl: "" }); }} className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
                          Add item
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Reservations Section ───────────────────────────────────────────────────

function ReservationsSection({
  program,
  setProgram,
  hasStructuredKnowledge,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
  hasStructuredKnowledge: boolean;
}) {
  const res = program.structuredWebsiteKnowledge.reservations;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(res);

  const hasData = res.bookingUrl || res.instructions || res.platforms.length > 0 || res.partySizeNotes || res.depositPolicy;

  const saveDraft = () => {
    setProgram((p) =>
      p ? { ...p, structuredWebsiteKnowledge: { ...p.structuredWebsiteKnowledge, reservations: { ...draft } } } : p
    );
    setEditing(false);
  };

  return (
    <SectionCard
      title="Reservations"
      description="Booking details your chatbot will use to answer reservation questions."
      actions={!editing ? <EditIconButton onClick={() => { setDraft(res); setEditing(true); }} /> : undefined}
    >
      {editing ? (
        <div className="space-y-4">
          <TextInput label="Booking URL" value={draft.bookingUrl ?? ""} onChange={(v) => setDraft((d) => ({ ...d, bookingUrl: v || null }))} placeholder="https://resy.com/..." type="url" />
          <TextInput label="Instructions" multiline rows={2} value={draft.instructions} onChange={(v) => setDraft((d) => ({ ...d, instructions: v }))} placeholder="Call us at (555) 123-4567 or book online via..." />
          <TextInput label="Party size notes" value={draft.partySizeNotes ?? ""} onChange={(v) => setDraft((d) => ({ ...d, partySizeNotes: v || null }))} placeholder="e.g. Groups larger than 8 please call" />
          <TextInput label="Deposit policy" value={draft.depositPolicy ?? ""} onChange={(v) => setDraft((d) => ({ ...d, depositPolicy: v || null }))} placeholder="e.g. $25 deposit required for large parties" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setDraft(res); setEditing(false); }} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={saveDraft} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Apply</button>
          </div>
        </div>
      ) : hasData ? (
        <dl className="space-y-3 text-sm">
          {res.platforms.length > 0 && (
            <div className="flex items-start gap-2">
              <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Platform</dt>
              <dd className="flex flex-wrap gap-1.5">{res.platforms.map((p) => <StatusBadge key={p} label={p} tone="info" />)}</dd>
            </div>
          )}
          {res.instructions && (
            <div className="flex items-start gap-2">
              <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Instructions</dt>
              <dd className="text-[var(--color-text)]">{res.instructions}</dd>
            </div>
          )}
          {res.bookingUrl && (
            <div className="flex items-start gap-2">
              <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Booking URL</dt>
              <dd><a href={res.bookingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--color-primary)] underline decoration-dashed hover:decoration-solid">{res.bookingUrl}</a></dd>
            </div>
          )}
          {res.partySizeNotes && (
            <div className="flex items-start gap-2">
              <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Party size</dt>
              <dd className="text-[var(--color-text)]">{res.partySizeNotes}</dd>
            </div>
          )}
          {res.depositPolicy && (
            <div className="flex items-start gap-2">
              <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Deposit</dt>
              <dd className="text-[var(--color-text)]">{res.depositPolicy}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No reservation info yet.</p>
          <button type="button" onClick={() => { setDraft(res); setEditing(true); }} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
            {hasStructuredKnowledge ? "Add reservation details" : "Add reservation details"}
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Policies Section ───────────────────────────────────────────────────────

function PoliciesSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState({ title: "", body: "", category: "Policies" });

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
    <SectionCard
      title={`Policies \u2014 ${program.policies.length}`}
      description="Allergen info, group policies, cancellation terms, and other rules your chatbot should know."
      actions={<AddButton label="Add policy" onClick={() => setAddingPolicy(true)} />}
    >
      {addingPolicy && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 space-y-3">
          <TextInput label="Title" value={policyDraft.title} onChange={(v) => setPolicyDraft((d) => ({ ...d, title: v }))} placeholder="e.g. Allergen policy" />
          <TextInput label="Details" multiline rows={3} value={policyDraft.body} onChange={(v) => setPolicyDraft((d) => ({ ...d, body: v }))} placeholder="We take allergens seriously..." />
          <TextInput label="Category" value={policyDraft.category} onChange={(v) => setPolicyDraft((d) => ({ ...d, category: v }))} placeholder="Policies" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddingPolicy(false)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={addPolicy} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Save policy</button>
          </div>
        </div>
      )}
      {program.policies.length === 0 && !addingPolicy ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No policies yet.</p>
          <button type="button" onClick={() => setAddingPolicy(true)} className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">Add first policy</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {program.policies.map((policy) => {
            const isOpen = expandedId === policy.id;
            return (
              <li key={policy.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors" onClick={() => setExpandedId(isOpen ? null : policy.id)}>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[9px] font-bold text-[var(--color-text-muted)]">K</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">{policy.title}</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{policy.category}</p>
                  </div>
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen ? (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-4 pt-3 space-y-3">
                    <TextInput label="Title" value={policy.title} onChange={(v) => setProgram((p) => p ? { ...p, policies: p.policies.map((pl) => pl.id === policy.id ? { ...pl, title: v } : pl) } : p)} />
                    <TextInput label="Details" multiline rows={3} value={policy.description} onChange={(v) => setProgram((p) => p ? { ...p, policies: p.policies.map((pl) => pl.id === policy.id ? { ...pl, description: v } : pl) } : p)} />
                    <TextInput label="Category" value={policy.category} onChange={(v) => setProgram((p) => p ? { ...p, policies: p.policies.map((pl) => pl.id === policy.id ? { ...pl, category: v } : pl) } : p)} />
                    <div className="flex justify-between">
                      <DeleteIconButton onClick={() => deletePolicy(policy.id)} />
                      <button type="button" onClick={() => setExpandedId(null)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Done</button>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{policy.description}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Legacy FAQ Section (demoted to bottom) ─────────────────────────────────

// Show at most this many Q&A entries before the "View all" toggle appears.
const FAQ_PREVIEW_LIMIT = 5;

function LegacyFaqSection({
  program,
  setProgram,
}: {
  program: KnowledgeProgram;
  setProgram: React.Dispatch<React.SetStateAction<KnowledgeProgram | null>>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingFaq, setAddingFaq] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [faqDraft, setFaqDraft] = useState({ question: "", answer: "", category: "General" });

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

  return (
    <SectionCard
      eyebrow="Imported Q&A"
      title={`Questions & Answers \u2014 ${program.faqs.length}`}
      description="These answers back up your main knowledge above. The chatbot uses menus, events, and policies first."
      eyebrowClassName="text-[var(--color-text-muted)]"
      titleClassName="text-[var(--color-text-secondary)]"
      className="opacity-90 border-dashed"
      actions={
        <button type="button" onClick={() => setAddingFaq(true)} className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
          Add Q&amp;A
        </button>
      }
    >
      {addingFaq && (
        <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <TextInput label="Question" value={faqDraft.question} onChange={(v) => setFaqDraft((d) => ({ ...d, question: v }))} placeholder="e.g. Do you have gluten-free options?" />
          <TextInput label="Answer" multiline rows={3} value={faqDraft.answer} onChange={(v) => setFaqDraft((d) => ({ ...d, answer: v }))} placeholder="Yes, we offer..." />
          <TextInput label="Category (optional)" value={faqDraft.category} onChange={(v) => setFaqDraft((d) => ({ ...d, category: v }))} placeholder="General" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddingFaq(false)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="button" onClick={addFaq} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Save Q&amp;A</button>
          </div>
        </div>
      )}
      {program.faqs.length === 0 && !addingFaq ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No Q&amp;A entries. Use the structured sections above for primary knowledge.</p>
          <button type="button" onClick={() => setAddingFaq(true)} className="mt-3 rounded-xl bg-[var(--color-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Add anyway</button>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {(showAll ? program.faqs : program.faqs.slice(0, FAQ_PREVIEW_LIMIT)).map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <li key={faq.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors" onClick={() => setExpandedId(isOpen ? null : faq.id)}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[10px] font-bold text-[var(--color-text-muted)]">Q</span>
                    <p className="flex-1 text-sm font-medium text-[var(--color-text-secondary)]">{faq.question}</p>
                    <ChevronIcon open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-4 pt-3 space-y-3">
                      <TextInput label="Question" value={faq.question} onChange={(v) => updateFaq(faq.id, { question: v })} />
                      <TextInput label="Answer" multiline rows={3} value={faq.answer} onChange={(v) => updateFaq(faq.id, { answer: v })} />
                      <TextInput label="Category" value={faq.category} onChange={(v) => updateFaq(faq.id, { category: v })} />
                      <div className="flex justify-between">
                        <DeleteIconButton onClick={() => deleteFaq(faq.id)} />
                        <button type="button" onClick={() => setExpandedId(null)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">Done</button>
                      </div>
                    </div>
                  )}
                  {!isOpen && (
                    <p className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{faq.answer}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {program.faqs.length > FAQ_PREVIEW_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
            >
              {showAll
                ? "Show fewer Q&A"
                : `View all ${program.faqs.length} imported Q&A`}
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}
