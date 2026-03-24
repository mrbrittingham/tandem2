"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem, WidgetThemeSettings } from "@tandem/shared";
import type {
  ImportEvent,
  ImportMembershipInfo,
  ImportMenuSection,
  ImportReservationInfo,
  WebsiteImportDraft,
  WebsiteImportRunRecord,
  WebsitePageType,
} from "@/lib/website-import/types";
import { SCHEMA_OUT_OF_DATE_CODE } from "@/lib/website-import/api-errors";
import { buildThemeFromDraft } from "@/lib/website-import/apply";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { TextInput } from "./TextInput";
import { updateBusiness } from "@/lib/store-hooks";
import { usePreviewDock } from "@/components/PreviewDockContext";

// ── Color helpers ────────────────────────────────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex : `#${hex}`;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0)
          : max === g ? (b - r) / d + 2
          : (r - g) / d + 4;
  hue /= 6;
  return [Math.round(hue * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0").toUpperCase();
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ── HueWheelPicker ───────────────────────────────────────────────────────────
const W = 180, CX = 90, CY = 90, OUTER = 78, INNER = 54, MID = 66, THUMB_R = 8, CENTER_R = 28;

function HueWheelPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value));
  // Ref mirrors hsl so applyAngle always reads the latest S/L without stale closures
  const hslRef = useRef(hsl);
  useEffect(() => { hslRef.current = hsl; }, [hsl]);

  // Sync hsl from external value prop, but only when the user is not mid-drag
  // so local state is never overwritten while dragging.
  useEffect(() => {
    if (!dragging.current) {
      setHsl(hexToHsl(value));
    }
  }, [value]);

  // Draw wheel — depends on hsl only; center uses hslToHex(hsl) so it always
  // matches the thumb position rather than the (potentially one-render-behind) value prop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, W);

    // Hue ring as annulus slices
    for (let i = 0; i < 360; i++) {
      const a0 = ((i - 90) * Math.PI) / 180;
      const a1 = ((i + 1.5 - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(CX, CY, OUTER, a0, a1);
      ctx.arc(CX, CY, INNER, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${i},100%,50%)`;
      ctx.fill();
    }

    // Center circle — derived from local hsl state so it stays in sync during drag
    const localHex = hslToHex(...hsl);
    ctx.beginPath();
    ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2);
    ctx.fillStyle = localHex;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hue thumb
    const thumbAngle = ((hsl[0] - 90) * Math.PI) / 180;
    const tx = CX + MID * Math.cos(thumbAngle);
    const ty = CY + MID * Math.sin(thumbAngle);
    ctx.beginPath();
    ctx.arc(tx, ty, THUMB_R, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [hsl]);

  // applyAngle reads S/L from hslRef synchronously — no setState updater needed,
  // so onChange is never called inside a state updater (the root cause of the error).
  const applyAngle = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale - CX;
    const y = (clientY - rect.top) * scale - CY;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < INNER - 10 || dist > OUTER + 10) return;
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    if (angle >= 360) angle -= 360;
    const newHue = Math.round(angle);
    const [, s, l] = hslRef.current;
    const newS = s < 10 ? 80 : s;
    // L=0 (black) and L=100 (white) are achromatic at any hue — snap to a
    // visible lightness the first time the user drags so color actually appears.
    const newL = l < 5 ? 45 : l > 95 ? 85 : l;
    const next: [number, number, number] = [newHue, newS, newL];
    // Two independent calls — no side effects inside a state updater
    setHsl(next);
    onChange(hslToHex(...next));
  }, [onChange]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={W}
      style={{ width: W, height: W, cursor: "crosshair", borderRadius: "50%" }}
      onMouseDown={(e) => { dragging.current = true; applyAngle(e.clientX, e.clientY); }}
      onMouseMove={(e) => { if (dragging.current) applyAngle(e.clientX, e.clientY); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    />
  );
}

// ColorPickerSwatch is now the shared ColorSwatchPicker component (see ColorSwatchPicker.tsx).

type LatestImportResponse = {
  location?: {
    id: string;
    websiteUrl?: string | null;
  };
  run?: WebsiteImportRunRecord | null;
  code?: string;
  error?: string;
};

type StartImportResponse = {
  runId?: string;
  code?: string;
  error?: string;
};

type RunResponse = {
  run?: WebsiteImportRunRecord;
  code?: string;
  error?: string;
};

type ApplyResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
};

type LocationOption = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
};

type LocationsResponse = {
  locations?: LocationOption[];
  error?: string;
};

export type ImportedKnowledgePayload = {
  name?: string;
  shortDescription?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  faqs: FAQItem[];
  policies: PolicyItem[];
  insights?: {
    eventHighlights?: string;
    reservationGuidance?: string;
    membershipNotes?: string;
    menuSummary?: string;
  };
  structured?: {
    events: ImportEvent[];
    menuSections: ImportMenuSection[];
    reservations: ImportReservationInfo;
    memberships: ImportMembershipInfo;
    pageClassification: Array<{ url: string; title: string; pageType: WebsitePageType }>;
  };
};

function getFriendlyImportError(error?: string, code?: string) {
  if (code === SCHEMA_OUT_OF_DATE_CODE) {
    return "Database schema is out of date. Run npm run db:push.";
  }

  const message = (error ?? "").toLowerCase();
  if (
    message.includes("schema cache")
    || (message.includes("onboarding_import_runs") && message.includes("does not exist"))
    || (message.includes("business_locations") && message.includes("website_url") && message.includes("does not exist"))
  ) {
    return "Database schema is out of date. Run npm run db:push.";
  }

  return error ?? "Something went wrong. Please try again.";
}

function toFaqItems(draft: WebsiteImportDraft): FAQItem[] {
  const nowIso = new Date().toISOString();
  return draft.faqs
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: "Imported",
      showInHelp: true,
      updatedAt: nowIso,
    }));
}

function toPolicyItems(draft: WebsiteImportDraft): PolicyItem[] {
  const nowIso = new Date().toISOString();
  return draft.policies
    .filter((entry) => entry.include)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.summary,
      category: "Imported",
      showInHelp: true,
      updatedAt: nowIso,
    }));
}


function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeAge(value?: string | null): string {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 2) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function labelPageType(pageType: WebsitePageType) {
  switch (pageType) {
    case "menu": return "Menu";
    case "events": return "Events";
    case "reservations": return "Reservations";
    case "memberships": return "Memberships";
    case "private-events": return "Private events";
    case "catering": return "Catering";
    case "contact": return "Contact";
    case "hours": return "Hours";
    case "faq": return "FAQ";
    case "policies": return "Policies";
    case "about": return "About";
    case "home": return "Home";
    default: return "General";
  }
}

function normalizeDraft(draft: WebsiteImportDraft | null): WebsiteImportDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    pageClassification: Array.isArray(draft.pageClassification) ? draft.pageClassification : [],
    restaurantKnowledge: {
      events: Array.isArray(draft.restaurantKnowledge?.events) ? draft.restaurantKnowledge.events : [],
      menuSections: Array.isArray(draft.restaurantKnowledge?.menuSections) ? draft.restaurantKnowledge.menuSections : [],
      reservations: draft.restaurantKnowledge?.reservations ?? {
        include: false,
        sourceUrl: null,
        bookingUrl: null,
        platforms: [],
        instructions: "",
        partySizeNotes: null,
        depositPolicy: null,
        experienceNotes: null,
      },
      memberships: draft.restaurantKnowledge?.memberships ?? {
        include: false,
        sourceUrl: null,
        name: "",
        benefits: "",
        pickupDetails: null,
        signupUrl: null,
        memberEventNotes: null,
      },
    },
  };
}

export function WebsiteImportPanel({
  business,
  onApplyImportedContent,
}: {
  business: BusinessProfile;
  onApplyImportedContent?: (payload: ImportedKnowledgePayload) => void;
}) {
  const businessSlug = (business.businessSlug ?? business.slug ?? "").trim();
  const initialLocationSlug = (business.locationSlug ?? business.slug ?? "").trim();

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationSlug, setSelectedLocationSlug] = useState("");
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [url, setUrl] = useState("");
  const [run, setRun] = useState<WebsiteImportRunRecord | null>(null);
  const [draft, setDraft] = useState<WebsiteImportDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [menuImportMode, setMenuImportMode] = useState<"url" | "text" | null>(null);
  const [menuImportInput, setMenuImportInput] = useState("");
  const [isMenuImporting, setIsMenuImporting] = useState(false);
  const [colorSchemeAccepted, setColorSchemeAccepted] = useState<boolean | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const { setDraftTheme } = usePreviewDock();

  // Reset color overrides whenever a new scan result arrives
  useEffect(() => { setColorOverrides({}); }, [run?.id]);

  // Push a projected widget theme into the preview dock whenever scan results are available.
  // The preview stays live as the user tweaks color overrides. Cleared on unmount or Skip.
  const scanPreviewTheme = useMemo<WidgetThemeSettings | undefined>(() => {
    if (!draft || colorSchemeAccepted === false) return undefined;
    const hasBrand = Boolean(draft.brand?.primaryColor?.value || draft.brand?.accentColor?.value);
    if (!hasBrand) return undefined;
    const effectiveDraft: WebsiteImportDraft = Object.keys(colorOverrides).length > 0 ? {
      ...draft,
      brand: {
        ...draft.brand,
        primaryColor: { ...draft.brand.primaryColor, value: colorOverrides["Brand"] ?? draft.brand.primaryColor.value },
        accentColor: { ...draft.brand.accentColor, value: colorOverrides["Accent"] ?? draft.brand.accentColor.value },
        backgroundColor: { ...draft.brand.backgroundColor, value: colorOverrides["Chat background"] ?? draft.brand.backgroundColor.value },
        textColor: { ...draft.brand.textColor, value: colorOverrides["Body text"] ?? draft.brand.textColor.value },
        mutedTextColor: { ...(draft.brand.mutedTextColor ?? { value: null, sourceUrl: null }), value: colorOverrides["Muted text"] ?? draft.brand.mutedTextColor?.value ?? null },
      },
    } : draft;
    return buildThemeFromDraft(effectiveDraft, business.theme);
  }, [draft, colorOverrides, colorSchemeAccepted, business.theme]);

  useEffect(() => {
    setDraftTheme(scanPreviewTheme);
    return () => { setDraftTheme(undefined); };
  }, [scanPreviewTheme, setDraftTheme]);

  const selectedLocation = useMemo(
    () => locationOptions.find((entry) => entry.slug === selectedLocationSlug),
    [locationOptions, selectedLocationSlug],
  );

  const locationGuardError = useMemo(() => {
    if (!businessSlug) {
      return "Business details are missing. Select a valid location before scanning.";
    }
    if (!locationOptions.length) {
      return isLoadingLocations ? null : "No locations found for this business.";
    }
    if (!selectedLocation) {
      return "Choose a valid location before scanning.";
    }
    return null;
  }, [businessSlug, isLoadingLocations, locationOptions.length, selectedLocation]);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      if (!businessSlug) {
        setLocationOptions([]);
        setSelectedLocationSlug("");
        return;
      }

      setIsLoadingLocations(true);

      try {
        const params = new URLSearchParams();
        params.set("businessSlug", businessSlug);

        const response = await fetch(`/api/locations?${params.toString()}`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as LocationsResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load locations");
        }

        const options = payload.locations ?? [];
        setLocationOptions(options);
        const preferred = options.find((entry) => entry.slug === initialLocationSlug) ?? options[0];
        setSelectedLocationSlug(preferred?.slug ?? "");
      } catch {
        if (!cancelled) {
          setLocationOptions([]);
          setSelectedLocationSlug("");
          setError("Could not load locations for website scan.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocations(false);
        }
      }
    };

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, initialLocationSlug]);

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      if (locationGuardError || !selectedLocationSlug) {
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("businessSlug", businessSlug);
        params.set("locationSlug", selectedLocationSlug);

        const response = await fetch(`/api/website-import/latest?${params.toString()}`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as LatestImportResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(getFriendlyImportError(payload.error, payload.code));
          return;
        }

        setUrl((payload.location?.websiteUrl ?? payload.run?.url ?? "").trim());
        setRun(payload.run ?? null);
        setDraft(normalizeDraft(payload.run?.result ?? null));

        if (payload.run?.id && (payload.run.status === "queued" || payload.run.status === "running")) {
          setActiveRunId(payload.run.id);
          setIsLoading(true);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load the latest scan.");
        }
      }
    };

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, locationGuardError, selectedLocationSlug]);

  const runImport = async () => {
    const targetUrl = url.trim();

    if (!targetUrl) {
      setError("Website URL is required.");
      return;
    }

    if (locationGuardError || !selectedLocationSlug) {
      setError(locationGuardError ?? "Choose a valid location before scanning.");
      return;
    }

    setError(null);
    setSuccess(null);
    setDraft(null);
    setIsLoading(true);
    setColorSchemeAccepted(null);

    try {
      const response = await fetch("/api/website-import/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          businessSlug,
          locationSlug: selectedLocationSlug,
          url: targetUrl,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as StartImportResponse;
      if (!response.ok || !payload.runId) {
        throw new Error(getFriendlyImportError(payload.error, payload.code));
      }

      setActiveRunId(payload.runId);
      setSuccess("Scan started. Tandem is classifying pages and extracting structured restaurant knowledge.");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Scan failed";
      setError(message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const runResponse = await fetch(`/api/website-import/${encodeURIComponent(activeRunId)}`, {
          method: "GET",
        });

        const runPayload = (await runResponse.json().catch(() => ({}))) as RunResponse;

        if (cancelled) {
          return;
        }

        if (!runResponse.ok || !runPayload.run) {
          throw new Error(getFriendlyImportError(runPayload.error, runPayload.code));
        }

        setRun(runPayload.run);
        setDraft(normalizeDraft(runPayload.run.result ?? null));

        if (runPayload.run.status === "succeeded") {
          setSuccess("Scan complete. Review detected knowledge and apply when ready.");
          setIsLoading(false);
          setActiveRunId(null);
          return;
        }

        if (runPayload.run.status === "failed") {
          setError(getFriendlyImportError(runPayload.run.error ?? "Scan failed", runPayload.run.errorCode ?? undefined));
          setIsLoading(false);
          setActiveRunId(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          const message = pollError instanceof Error ? pollError.message : "Failed to load scan status";
          setError(message);
          setIsLoading(false);
          setActiveRunId(null);
        }
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeRunId]);

  const setEventInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        events: current.restaurantKnowledge.events.map((entry) => entry.id === id ? { ...entry, include } : entry),
      },
    } : current);
  };

  const removeEvent = (id: string) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        events: current.restaurantKnowledge.events.filter((entry) => entry.id !== id),
      },
    } : current);
  };

  const setMenuInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        menuSections: current.restaurantKnowledge.menuSections.map((entry) => entry.id === id ? { ...entry, include } : entry),
      },
    } : current);
  };

  const removeMenu = (id: string) => {
    setDraft((current) => current ? {
      ...current,
      restaurantKnowledge: {
        ...current.restaurantKnowledge,
        menuSections: current.restaurantKnowledge.menuSections.filter((entry) => entry.id !== id),
      },
    } : current);
  };

  const importMenuManually = async () => {
    if (!menuImportInput.trim() || !draft) return;

    setIsMenuImporting(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (menuImportMode === "url") {
        body.url = menuImportInput.trim();
      } else {
        body.text = menuImportInput.trim();
      }

      const response = await fetch("/api/website-import/menu-extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; sections?: ImportMenuSection[]; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Menu extraction failed");
      }

      const newSections = payload.sections ?? [];
      if (newSections.length === 0) {
        setError("No menu items could be extracted from the provided content.");
        return;
      }

      setDraft((current) => current ? {
        ...current,
        restaurantKnowledge: {
          ...current.restaurantKnowledge,
          menuSections: [...current.restaurantKnowledge.menuSections, ...newSections],
        },
      } : current);

      setMenuImportMode(null);
      setMenuImportInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Menu import failed");
    } finally {
      setIsMenuImporting(false);
    }
  };

  const setPolicyInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      policies: current.policies.map((entry) => entry.id === id ? { ...entry, include } : entry),
    } : current);
  };

  const setFaqInclude = (id: string, include: boolean) => {
    setDraft((current) => current ? {
      ...current,
      faqs: current.faqs.map((entry) => entry.id === id ? { ...entry, include } : entry),
    } : current);
  };

  const removeFaq = (id: string) => {
    setDraft((current) => current ? {
      ...current,
      faqs: current.faqs.filter((entry) => entry.id !== id),
    } : current);
  };

  const applyImport = async () => {
    if (!run?.id || !draft) {
      return;
    }

    setIsApplying(true);
    setError(null);
    setSuccess(null);

    try {
      // Build an effective draft that incorporates any user-edited color overrides
      const applyColors = colorSchemeAccepted === true;
      const effectiveDraft: WebsiteImportDraft = applyColors && Object.keys(colorOverrides).length > 0 ? {
        ...draft,
        brand: {
          ...draft.brand,
          primaryColor: { ...draft.brand.primaryColor, value: colorOverrides["Brand"] ?? draft.brand.primaryColor.value },
          accentColor: { ...draft.brand.accentColor, value: colorOverrides["Accent"] ?? draft.brand.accentColor.value },
          backgroundColor: { ...draft.brand.backgroundColor, value: colorOverrides["Chat background"] ?? draft.brand.backgroundColor.value },
          textColor: { ...draft.brand.textColor, value: colorOverrides["Body text"] ?? draft.brand.textColor.value },
          mutedTextColor: { ...(draft.brand.mutedTextColor ?? { value: null, sourceUrl: null }), value: colorOverrides["Muted text"] ?? draft.brand.mutedTextColor?.value ?? null },
        },
      } : draft;

      const response = await fetch(`/api/website-import/${encodeURIComponent(run.id)}/apply`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ draft: effectiveDraft, applyColorScheme: applyColors }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApplyResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(getFriendlyImportError(payload.error, payload.code));
      }

      const importedFaqs = toFaqItems(effectiveDraft);
      const importedPolicies = toPolicyItems(effectiveDraft);
      const nextTheme = applyColors ? buildThemeFromDraft(effectiveDraft, business.theme) : business.theme;

      updateBusiness(business.id, (record) => {
        if (draft.businessProfile.name.value) {
          record.businessName = draft.businessProfile.name.value;
          record.name = draft.businessProfile.name.value;
        }
        if (draft.businessProfile.shortDescription.value) {
          record.summary = draft.businessProfile.shortDescription.value;
          record.tagline = draft.businessProfile.shortDescription.value;
        }
        if (draft.businessProfile.address.value) {
          record.location = draft.businessProfile.address.value;
        }

        if (applyColors) {
          record.theme = nextTheme;
        }

        if (importedFaqs.length > 0) {
          record.faqs = importedFaqs;
        }

        if (importedPolicies.length > 0) {
          record.policies = importedPolicies;
        }

        if (draft.businessProfile.hours.value) {
          record.handoff.supportHoursLabel = draft.businessProfile.hours.value;
          record.handoff.statusDetail = draft.businessProfile.hours.value;
        }

        record.updatedAt = new Date().toISOString();
      });

      onApplyImportedContent?.({
        name: draft.businessProfile.name.value ?? undefined,
        shortDescription: draft.businessProfile.shortDescription.value ?? undefined,
        phone: draft.businessProfile.phone.value ?? undefined,
        email: draft.businessProfile.email.value ?? undefined,
        address: draft.businessProfile.address.value ?? undefined,
        hours: draft.businessProfile.hours.value ?? undefined,
        faqs: importedFaqs,
        policies: importedPolicies,
        insights: {
          eventHighlights: draft.restaurantInsights?.eventHighlights ?? undefined,
          reservationGuidance: draft.restaurantInsights?.reservationGuidance ?? undefined,
          membershipNotes: draft.restaurantInsights?.membershipNotes ?? undefined,
          menuSummary: draft.restaurantInsights?.menuSummary ?? undefined,
        },
        structured: {
          events: draft.restaurantKnowledge.events.filter((entry) => entry.include),
          menuSections: draft.restaurantKnowledge.menuSections.filter((entry) => entry.include),
          reservations: draft.restaurantKnowledge.reservations,
          memberships: draft.restaurantKnowledge.memberships,
          pageClassification: draft.pageClassification,
        },
      });

      setSuccess("Structured website knowledge applied.");
      setRun((current) => current ? { ...current, appliedAt: new Date().toISOString() } : current);
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Failed to save imported details";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const pageTypeCounts = useMemo(() => {
    const result = new Map<WebsitePageType, number>();
    for (const entry of draft?.pageClassification ?? []) {
      result.set(entry.pageType, (result.get(entry.pageType) ?? 0) + 1);
    }
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
  }, [draft?.pageClassification]);

  return (
    <div className="space-y-5">
      {/* Scan Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Scan Website</h3>
        <p className="mt-1 text-sm text-slate-600">Tandem classifies pages first, then extracts structured restaurant knowledge by page type.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Location</span>
            <select
              value={selectedLocationSlug}
              onChange={(event) => setSelectedLocationSlug(event.target.value)}
              disabled={isLoadingLocations || locationOptions.length === 0}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
            >
              {locationOptions.length === 0 ? <option value="">No locations available</option> : null}
              {locationOptions.map((location) => (
                <option key={location.id} value={location.slug}>{location.name} ({location.slug})</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={runImport} disabled={isLoading || Boolean(locationGuardError)} className="rounded-2xl bg-[var(--console-primary)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? "Scanning..." : "Scan website"}
          </button>
        </div>

        <div className="mt-3">
          <TextInput label="Website URL" value={url} onChange={setUrl} placeholder="https://example.com" />
        </div>

        {run ? <p className="mt-3 text-xs text-slate-500">Last scan: {formatDate(run.finishedAt ?? run.createdAt)} ({run.status})</p> : null}
        {run ? <p className="mt-1 text-xs text-slate-500">Pages scanned: {run.pages.length} • Signals: {run.signals.emails.length + run.signals.phones.length + run.signals.addresses.length + run.signals.hours.length + run.signals.bookingLinks.length}</p> : null}
        {locationGuardError ? <p className="mt-2 text-sm text-amber-700">{locationGuardError}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
      </div>

      {/* Page Type Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Page Types</h3>
        {!draft ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">Run a scan to see page classification.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {pageTypeCounts.map(([pageType, count]) => (
              <span key={pageType} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{labelPageType(pageType)}: {count}</span>
            ))}
          </div>
        )}
      </div>

      {/* Detected Events — collapsible cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Events</h3>
        <div className="mt-3 space-y-2">
          {(draft?.restaurantKnowledge.events ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No events detected.</p>
          ) : draft?.restaurantKnowledge.events.map((event) => (
            <CollapsibleEventCard
              key={event.id}
              event={event}
              onToggleInclude={() => setEventInclude(event.id, !event.include)}
              onDelete={() => removeEvent(event.id)}
            />
          ))}
        </div>
      </div>

      {/* Detected Menus — collapsible cards + manual import */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Detected Menus</h3>
          {draft && !menuImportMode ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMenuImportMode("url"); setMenuImportInput(""); }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Import from URL
              </button>
              <button
                type="button"
                onClick={() => { setMenuImportMode("text"); setMenuImportInput(""); }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Paste menu text
              </button>
            </div>
          ) : null}
        </div>

        {menuImportMode ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            {menuImportMode === "url" ? (
              <TextInput
                label="Menu page URL"
                value={menuImportInput}
                onChange={setMenuImportInput}
                placeholder="https://restaurant.com/menu"
              />
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Paste menu text</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={6}
                  placeholder="Paste your menu content here..."
                  value={menuImportInput}
                  onChange={(e) => setMenuImportInput(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isMenuImporting || !menuImportInput.trim()}
                onClick={importMenuManually}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isMenuImporting ? "Extracting…" : "Extract menu"}
              </button>
              <button
                type="button"
                onClick={() => { setMenuImportMode(null); setMenuImportInput(""); }}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {(draft?.restaurantKnowledge.menuSections ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No menu sections detected.</p>
          ) : draft?.restaurantKnowledge.menuSections.map((section) => (
            <CollapsibleMenuCard
              key={section.id}
              section={section}
              onToggleInclude={() => setMenuInclude(section.id, !section.include)}
              onDelete={() => removeMenu(section.id)}
            />
          ))}
        </div>
      </div>

      {/* Detected Reservations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Reservations</h3>
        <p className="mt-2 text-sm text-slate-700">{draft?.restaurantKnowledge.reservations.instructions || "No reservation guidance detected."}</p>
        {draft?.restaurantKnowledge.reservations.bookingUrl ? (
          <p className="mt-1 text-xs text-slate-600">Booking URL: {draft.restaurantKnowledge.reservations.bookingUrl}</p>
        ) : null}
        {draft?.restaurantKnowledge.reservations.platforms?.length ? (
          <p className="mt-1 text-xs text-slate-600">Platforms: {draft.restaurantKnowledge.reservations.platforms.join(", ")}</p>
        ) : null}
      </div>

      {/* Detected Memberships */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Memberships</h3>
        <p className="mt-2 text-sm text-slate-700">{draft?.restaurantKnowledge.memberships.benefits || "No membership information detected."}</p>
      </div>

      {/* Detected Policies */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Detected Policies</h3>
        <div className="mt-3 space-y-2">
          {(draft?.policies ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No policies detected.</p>
          ) : draft?.policies.map((policy) => (
            <article key={policy.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{policy.title}</p>
                  <p className="text-sm text-slate-700">{policy.summary}</p>
                </div>
                <button type="button" onClick={() => setPolicyInclude(policy.id, !policy.include)} className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${policy.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{policy.include ? "Included" : "Excluded"}</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* FAQ Suggestions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">FAQ Suggestions</h3>
        <p className="mt-1 text-sm text-slate-500">Generated from extracted knowledge. Toggle to include or exclude.</p>
        <FaqList
          faqs={draft?.faqs ?? []}
          onToggleInclude={(id) => setFaqInclude(id, !(draft?.faqs.find((f) => f.id === id)?.include))}
          onDelete={removeFaq}
        />
      </div>

      {/* Detected Brand Colors */}
      {(() => {
        const primary = draft?.brand?.primaryColor?.value;
        const accent = draft?.brand?.accentColor?.value;
        const surface = draft?.brand?.backgroundColor?.value;
        const text = draft?.brand?.textColor?.value;
        if (!primary && !accent) return null;

        const swatchMeta: Record<string, { role: string; hint: string }> = {
          Brand: { role: "Header & user bubbles", hint: "Applied to the chat header, user message bubbles, and primary CTA." },
          Accent: { role: "Quick replies & send", hint: "Applied to quick-reply chips and the send button." },
          "Chat background": { role: "Chat window surface", hint: "Background of the chat window and message area." },
          "Body text": { role: "Primary text", hint: "Primary text color inside the chat." },
          "Muted text": { role: "Timestamps & labels", hint: "Timestamps and secondary labels — auto-derived from body text if not set." },
        };

        return (
          <div className={`rounded-2xl border p-5 shadow-sm shadow-slate-900/5 ${
            colorSchemeAccepted === true ? "border-emerald-300 bg-emerald-50" :
            colorSchemeAccepted === false ? "border-slate-200 bg-slate-50 opacity-60" :
            "border-amber-200 bg-amber-50"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Detected Brand Colors
                  {run?.finishedAt ? (
                    <span className="ml-2 text-xs font-normal text-slate-400" title={formatDate(run.finishedAt)}>
                      from {formatRelativeAge(run.finishedAt)}
                    </span>
                  ) : null}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Colors extracted from your website. Adjust swatches if needed, then accept to apply. The Appearance tab shows your <em>saved</em> widget theme — changes only take effect there after you click &quot;Apply structured knowledge&quot; below.
                </p>
              </div>
              <div className="flex shrink-0 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setColorSchemeAccepted(false)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    colorSchemeAccepted === false
                      ? "border-slate-400 bg-slate-200 text-slate-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setColorSchemeAccepted(true)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    colorSchemeAccepted === true
                      ? "border-emerald-400 bg-emerald-600 text-white"
                      : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Apply colors
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Brand", current: business.theme.primaryColor, suggested: primary },
                { label: "Accent", current: business.theme.accentColor, suggested: accent },
                { label: "Chat background", current: business.theme.surfaceColor, suggested: surface },
                { label: "Body text", current: business.theme.textPrimaryColor, suggested: text },
                { label: "Muted text", current: business.theme.textSecondaryColor, suggested: draft?.brand?.mutedTextColor?.value ?? business.theme.textSecondaryColor ?? "#475569" },
              ].filter((swatch) => swatch.suggested).map((swatch) => {
                const activeColor = colorOverrides[swatch.label] ?? swatch.suggested ?? "";
                const meta = swatchMeta[swatch.label];
                return (
                <div key={swatch.label} className="space-y-1.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{swatch.label}</p>
                    {meta && <p className="text-[10px] text-slate-400">{meta.role}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-10 w-10 shrink-0 rounded-full border-2 border-white shadow-md ring-1 ring-slate-200"
                      style={{ background: swatch.current ?? undefined }}
                      title={`Current: ${swatch.current ?? "unset"}`}
                    />
                    <svg className="h-3 w-3 shrink-0 text-slate-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h8m-2.5-2.5L10 6l-2.5 2.5" /></svg>
                    <ColorSwatchPicker
                      value={activeColor}
                      label={swatch.label}
                      onChange={(hex) => setColorOverrides((prev) => ({ ...prev, [swatch.label]: hex }))}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">{activeColor}</p>
                </div>
                );
              })}
            </div>

            {colorSchemeAccepted === null && (
              <p className="mt-3 text-xs text-amber-700">Accept or skip — the preview panel reflects these colors live. The Appearance tab only updates after you apply.</p>
            )}
            {colorSchemeAccepted === true && (
              <p className="mt-3 text-xs text-emerald-700">Colors will be applied when you click &quot;Apply structured knowledge&quot; below.</p>
            )}
          </div>
        );
      })()}

      {/* Review & Apply */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
        <h3 className="text-lg font-semibold text-slate-900">Review & Apply</h3>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => setDraft(null)} className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300">Clear draft</button>
          <button type="button" onClick={applyImport} disabled={isApplying || !draft} className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isApplying ? "Applying..." : "Apply structured knowledge"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Event Card                                             */
/* ------------------------------------------------------------------ */

function CollapsibleEventCard({
  event,
  onToggleInclude,
  onDelete,
}: {
  event: ImportEvent;
  onToggleInclude: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`rounded-xl border bg-slate-50/70 p-3 ${event.include ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500">{event.date ?? "Date unknown"}{event.time ? ` • ${event.time}` : ""}{event.location ? ` • ${event.location}` : ""}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onToggleInclude} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${event.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{event.include ? "Included" : "Excluded"}</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50" title="Remove event">✕</button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm text-slate-700">
          {event.description ? <p>{event.description}</p> : null}
          {event.category ? <p className="text-xs text-slate-500">Category: {event.category}</p> : null}
          {event.pricing ? <p className="text-xs text-slate-500">Price: {event.pricing}</p> : null}
          {event.bookingInfo ? <p className="text-xs text-slate-500">Booking notes: {event.bookingInfo}</p> : null}
          {event.bookingUrl ? <p className="text-xs text-slate-500">Booking URL: <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{event.bookingUrl}</a></p> : null}
          {event.sourceUrl ? <p className="text-xs text-slate-500">Source: <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{event.sourceUrl}</a></p> : null}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Menu Card                                              */
/* ------------------------------------------------------------------ */

function CollapsibleMenuCard({
  section,
  onToggleInclude,
  onDelete,
}: {
  section: ImportMenuSection;
  onToggleInclude: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = section.items.length;
  const previewItems = section.items.slice(0, 3).map((i) => i.name).join(", ");

  return (
    <article className={`rounded-xl border bg-slate-50/70 p-3 ${section.include ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{section.title}</p>
            <p className="truncate text-xs text-slate-500">{itemCount} item{itemCount !== 1 ? "s" : ""}{previewItems ? ` — ${previewItems}` : ""}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onToggleInclude} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${section.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{section.include ? "Included" : "Excluded"}</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50" title="Remove menu">✕</button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="space-y-1">
            {section.items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.description ? <span className="ml-1 text-slate-500">— {item.description}</span> : null}
                </div>
                {item.price ? <span className="shrink-0 font-medium text-slate-600">{item.price}</span> : null}
              </div>
            ))}
          </div>
          {section.sourceUrl ? (
            <p className="mt-2 text-xs text-slate-500">Source: <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{section.sourceUrl}</a></p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ List with collapse for 10+ items                               */
/* ------------------------------------------------------------------ */

function FaqList({
  faqs,
  onToggleInclude,
  onDelete,
}: {
  faqs: WebsiteImportDraft["faqs"];
  onToggleInclude: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const COLLAPSE_THRESHOLD = 10;
  const visible = showAll || faqs.length <= COLLAPSE_THRESHOLD ? faqs : faqs.slice(0, COLLAPSE_THRESHOLD);

  if (faqs.length === 0) {
    return (
      <div className="mt-3">
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">No FAQ suggestions detected.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {visible.map((faq) => (
        <article key={faq.id} className={`rounded-xl border bg-slate-50/70 p-3 ${faq.include ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{faq.question}</p>
              <p className="mt-0.5 text-sm text-slate-700">{faq.answer}</p>
              <div className="mt-1 flex items-center gap-3">
                {faq.sourceUrl ? (
                  <span className="text-xs text-slate-400">Source: {new URL(faq.sourceUrl).pathname}</span>
                ) : null}
                {faq.confidence != null ? (
                  <span className="text-xs text-slate-400">{Math.round(faq.confidence * 100)}% confidence</span>
                ) : null}
                {faq.lowConfidence ? <span className="text-xs text-amber-600">Low confidence</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => onToggleInclude(faq.id)} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${faq.include ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>{faq.include ? "Included" : "Excluded"}</button>
              <button type="button" onClick={() => onDelete(faq.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50" title="Remove FAQ">✕</button>
            </div>
          </div>
        </article>
      ))}
      {faqs.length > COLLAPSE_THRESHOLD ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showAll ? "Show fewer" : `Show all ${faqs.length} FAQs`}
        </button>
      ) : null}
    </div>
  );
}
