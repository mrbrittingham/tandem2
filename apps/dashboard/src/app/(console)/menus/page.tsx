"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { saveLocationConfig } from "@/lib/location-config-client";
import { useActiveBusiness, useIsLocationsServerFetched, useIsStoreHydrated } from "@/lib/store-hooks";

type MenuItem = {
  id: string;
  name: string;
  price: string;
  description: string;
  dietaryNotes: string;
  include: boolean;
};

type MenuSection = {
  id: string;
  title: string;
  sourceUrl: string | null;
  include: boolean;
  items: MenuItem[];
};

function createItem(): MenuItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: "",
    description: "",
    dietaryNotes: "",
    include: true,
  };
}

function createSection(title = ""): MenuSection {
  return {
    id: crypto.randomUUID(),
    title,
    sourceUrl: null,
    include: true,
    items: [createItem()],
  };
}

function normalizeItem(raw: Record<string, unknown>): MenuItem {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: str(raw.id) || crypto.randomUUID(),
    name: str(raw.name),
    price: str(raw.price),
    description: str(raw.description),
    dietaryNotes: str(raw.dietaryNotes),
    include: raw.include !== false,
  };
}

function normalizeSection(raw: unknown): MenuSection | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  return {
    id: str(obj.id) || crypto.randomUUID(),
    title: str(obj.title),
    sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl : null,
    include: obj.include !== false,
    items: rawItems
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map(normalizeItem),
  };
}

export default function MenusPage() {
  const hydrated = useIsStoreHydrated();
  const locationsFetched = useIsLocationsServerFetched();
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!hydrated || (!business && !locationsFetched)) return <PageLoader />;

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to manage its menus."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <MenuOrganizer />;
}

function MenuOrganizer() {
  const business = useActiveBusiness();
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [extractOpen, setExtractOpen] = useState(false);
  const [extractUrl, setExtractUrl] = useState("");
  const [extractText, setExtractText] = useState("");
  const [extractMode, setExtractMode] = useState<"url" | "text">("url");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;

    const hydrate = async () => {
      try {
        const params = new URLSearchParams();
        params.set("locationId", business.id);
        params.set("locationSlug", business.locationSlug ?? business.slug);
        if (business.businessSlug) params.set("businessSlug", business.businessSlug);

        const response = await fetch(`/api/location-config?${params.toString()}`, { method: "GET" });
        if (!response.ok) return;

        const payload = (await response.json().catch(() => ({}))) as {
          config?: { knowledgeConfig?: Record<string, unknown> };
        };

        const kc = payload.config?.knowledgeConfig ?? {};
        const swk = typeof kc.structuredWebsiteKnowledge === "object" && kc.structuredWebsiteKnowledge !== null
          ? (kc.structuredWebsiteKnowledge as Record<string, unknown>)
          : {};
        const rawSections = Array.isArray(swk.menuSections) ? swk.menuSections : [];
        const fetchedSections = rawSections.map(normalizeSection).filter((s): s is MenuSection => s !== null);

        setSections(fetchedSections);
        setInitialSnapshot(JSON.stringify(fetchedSections));
        if (fetchedSections.length > 0) {
          setExpandedSections(new Set([fetchedSections[0].id]));
        }
      } catch {
        // Best-effort hydration
      } finally {
        setLoaded(true);
      }
    };

    void hydrate();
  }, [business]);

  if (!business || !loaded) return <PageLoader />;

  const isDirty = JSON.stringify(sections) !== initialSnapshot;

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSection = () => {
    const s = createSection();
    setSections((prev) => [...prev, s]);
    setExpandedSections((prev) => new Set([...prev, s.id]));
  };

  const deleteSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, title } : s))
    );
  };

  const addItem = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, createItem()] } : s
      )
    );
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.filter((item) => item.id !== itemId) }
          : s
      )
    );
  };

  const updateItem = (sectionId: string, itemId: string, field: keyof MenuItem, value: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item
              ),
            }
          : s
      )
    );
  };

  const handleSave = async () => {
    if (!business || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLocationConfig({
        location: business,
        knowledgeConfig: {
          structuredWebsiteKnowledge: { menuSections: sections },
        },
      });
      setInitialSnapshot(JSON.stringify(sections));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    const input = extractMode === "url" ? extractUrl.trim() : extractText.trim();
    if (!input) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const body = extractMode === "url" ? { url: input } : { text: input };
      const response = await fetch("/api/website-import/menu-extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; sections?: unknown[]; error?: string };
      if (!response.ok || !data.ok) {
        setExtractError(data.error ?? "Extraction failed");
        return;
      }
      const extracted = (data.sections ?? [])
        .map(normalizeSection)
        .filter((s): s is MenuSection => s !== null && s.title.length > 0);
      if (extracted.length === 0) {
        setExtractError("No menu sections found. Try pasting the menu text directly.");
        return;
      }
      setSections((prev) => {
        const existingIds = new Set(prev.map((s) => s.title.toLowerCase().trim()));
        const merged = [...prev];
        for (const s of extracted) {
          if (!existingIds.has(s.title.toLowerCase().trim())) {
            merged.push(s);
          }
        }
        return merged;
      });
      setExpandedSections((prev) => new Set([...prev, ...extracted.map((s) => s.id)]));
      setExtractOpen(false);
      setExtractUrl("");
      setExtractText("");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Menu Organizer</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            Review, edit, and save your restaurant menus. The AI assistant uses this data to answer menu questions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setExtractOpen(true); setExtractError(null); }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]  px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]"
          >
            <SparkleIcon />
            Extract from website
          </button>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <PlusIcon />
            Add section
          </button>
        </div>
      </div>

      {/* Extract panel */}
      {extractOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Extract menu from website</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Enter a URL or paste menu text. New sections will be added without overwriting existing ones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExtractOpen(false)}
              className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setExtractMode("url")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                extractMode === "url"
                  ? "bg-[var(--color-primary)] text-[var(--color-text-inverse)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)]  text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              URL
            </button>
            <button
              type="button"
              onClick={() => setExtractMode("text")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                extractMode === "text"
                  ? "bg-[var(--color-primary)] text-[var(--color-text-inverse)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)]  text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              Paste text
            </button>
          </div>

          {extractMode === "url" ? (
            <input
              type="url"
              placeholder="https://yourrestaurant.com/menu"
              value={extractUrl}
              onChange={(e) => setExtractUrl(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]  px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          ) : (
            <textarea
              placeholder="Paste your menu content here..."
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              rows={6}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]  px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-y"
            />
          )}

          {extractError && (
            <p className="mt-2 text-xs text-red-600">{extractError}</p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleExtract()}
              disabled={extracting || (extractMode === "url" ? !extractUrl.trim() : !extractText.trim())}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {extracting ? "Extracting..." : "Extract menus"}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && !extractOpen && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]  p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-hover)]">
            <MenuBookIcon />
          </div>
          <p className="text-sm font-medium text-[var(--color-text)]">No menus yet</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Extract from your website or add sections manually.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => { setExtractOpen(true); setExtractError(null); }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]  px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]"
            >
              <SparkleIcon />
              Extract from website
            </button>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-hover)]"
            >
              <PlusIcon />
              Add section
            </button>
          </div>
        </div>
      )}

      {/* Sections list */}
      {sections.map((section, sectionIndex) => {
        const isExpanded = expandedSections.has(section.id);
        return (
          <div
            key={section.id}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)]">
              <button
                type="button"
                onClick={() => toggleExpand(section.id)}
                className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                aria-label={isExpanded ? "Collapse section" : "Expand section"}
              >
                <ChevronIcon open={isExpanded} />
              </button>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                  placeholder="Section name (e.g. Appetizers)"
                  className="w-full bg-transparent text-sm font-semibold text-[var(--color-text)] placeholder:font-normal placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
              </div>

              <span className="flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                {section.items.length} {section.items.length === 1 ? "item" : "items"}
              </span>

              <button
                type="button"
                onClick={() => deleteSection(section.id)}
                className="flex-shrink-0 rounded-md p-1 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 transition"
                aria-label="Delete section"
              >
                <TrashIcon />
              </button>
            </div>

            {/* Section items */}
            {isExpanded && (
              <div className="border-t border-[var(--color-border)]">
                {section.items.length > 0 && (
                  <div>
                    {/* Column headers */}
                    <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_2rem] gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-disabled-bg)] border-b border-[var(--color-border)]">
                      <span>Name</span>
                      <span>Price</span>
                      <span>Description</span>
                      <span>Dietary notes</span>
                      <span />
                    </div>

                    {/* Item rows */}
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[2fr_1fr_2fr_1.5fr_2rem] gap-2 px-4 py-2 items-center border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]/40 group"
                      >
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(section.id, item.id, "name", e.target.value)}
                          placeholder="Item name"
                          className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)]  focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30 rounded-sm"
                        />
                        <input
                          type="text"
                          value={item.price}
                          onChange={(e) => updateItem(section.id, item.id, "price", e.target.value)}
                          placeholder="$0.00"
                          className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)]  focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30 rounded-sm"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(section.id, item.id, "description", e.target.value)}
                          placeholder="Brief description"
                          className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)]  focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30 rounded-sm"
                        />
                        <input
                          type="text"
                          value={item.dietaryNotes}
                          onChange={(e) => updateItem(section.id, item.id, "dietaryNotes", e.target.value)}
                          placeholder="GF, vegan, etc."
                          className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)]  focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30 rounded-sm"
                        />
                        <button
                          type="button"
                          onClick={() => deleteItem(section.id, item.id)}
                          className="rounded p-1 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition"
                          aria-label="Delete item"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item row */}
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => addItem(section.id)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition"
                  >
                    <PlusIcon size={12} />
                    Add item
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add section button (when sections exist) */}
      {sections.length > 0 && (
        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]  px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
        >
          <PlusIcon />
          Add section
        </button>
      )}

      {saveError && (
        <p className="text-sm text-red-600">{saveError}</p>
      )}

      <SaveBar visible={isDirty} onSave={() => void handleSave()} saving={saving} />
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.5h10" />
      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
      <path d="M3.5 4.5l.75 7.5a1 1 0 0 0 1 .9h4.5a1 1 0 0 0 1-.9l.75-7.5" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

function MenuBookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17V4a2 2 0 0 1 2-2h9v13H6a2 2 0 0 0-2 2Z" />
      <path d="M4 17a2 2 0 0 0 2 2h9v-4H6a2 2 0 0 0-2 2Z" />
      <path d="M8 6h5M8 9h5M8 12h3" />
    </svg>
  );
}
