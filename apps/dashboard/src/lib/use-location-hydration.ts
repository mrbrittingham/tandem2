"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { FAQItem, HandoffConfig, OperatingHoursBlock, WidgetThemeSettings } from "@tandem/shared";
import { normalizeWidgetTheme } from "@/lib/widget-theme";
import { markLocationsFetched, syncLocationsFromServer, updateBusiness, useActiveLocation } from "@/lib/store-hooks";

type ServerLocationConfig = {
  phone?: string;
  timezone?: string;
  legacyLocationName?: string;
  legacyAddress?: string;
  /** Structured hours blocks from businessProfile.hours — shown in HoursPanel */
  hours?: OperatingHoursBlock[];
  /** FAQs from the top-level faqs key — shown in KnowledgePanel */
  faqs?: FAQItem[];
  /** Full handoff config — shown in HandoffPanel */
  handoff?: Partial<HandoffConfig>;
};

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readServerLocationConfig(value: unknown): ServerLocationConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const root = value as Record<string, unknown>;

  // ── knowledge_config ──────────────────────────────────────────────────────
  const knowledgeConfig = asObj(root.knowledgeConfig);
  const businessProfile = asObj(knowledgeConfig.businessProfile);
  const str = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    return typeof v === "string" && v.trim().length ? v.trim() : undefined;
  };

  // Structured hours blocks written by the tool executor and the settings page.
  const rawHours = businessProfile.hours;
  const hours: OperatingHoursBlock[] | undefined = Array.isArray(rawHours) && rawHours.length > 0
    ? (rawHours as OperatingHoursBlock[])
    : undefined;

  // FAQs at the top-level knowledge_config.faqs key (canonical path from toKnowledgeConfig
  // and the fixed tool executor). Fall back to knowledgeProgram.faqs for data written before
  // the executor path fix.
  const topFaqs = Array.isArray(knowledgeConfig.faqs) ? (knowledgeConfig.faqs as FAQItem[]) : undefined;
  const legacyFaqs = Array.isArray(asObj(knowledgeConfig.knowledgeProgram).faqs)
    ? (asObj(knowledgeConfig.knowledgeProgram).faqs as FAQItem[])
    : undefined;
  const faqs = topFaqs?.length ? topFaqs : legacyFaqs?.length ? legacyFaqs : undefined;

  // ── handoff_config ────────────────────────────────────────────────────────
  const handoffConfig = asObj(root.handoffConfig);
  const hasHandoff = Object.keys(handoffConfig).length > 0;

  return {
    phone: str(businessProfile, "phone"),
    timezone: str(businessProfile, "timezone"),
    legacyLocationName: str(businessProfile, "locationName"),
    legacyAddress: str(businessProfile, "address"),
    hours,
    faqs,
    handoff: hasHandoff ? (handoffConfig as Partial<HandoffConfig>) : undefined,
  };
}

/**
 * Hydrates locations from the server on mount and whenever search params change.
 * Also fetches and applies saved widget themes so the chatbot preview always
 * starts with the correct brand colors. After syncing identity fields, also
 * applies hours, FAQs, and handoff from Supabase into the mock-store so that
 * overview panels show the correct server-persisted state on page refresh.
 */
export function useLocationHydration() {
  const searchParams = useSearchParams();
  const activeBusiness = useActiveLocation();

  useEffect(() => {
    const debugLocation = searchParams.get("debugLocation") === "1";
    let cancelled = false;

    const hydrateLocations = async () => {
      try {
        const response = await fetch("/api/locations", { method: "GET" });
        if (!response.ok) return;

        const payload = (await response.json().catch(() => ({}))) as {
          locations?: Array<{ id?: string; businessId?: string; slug?: string; name?: string; address?: string | null; createdAt?: string }>;
        };

        const serverLocations = payload.locations ?? [];

        const snapshots = await Promise.all(serverLocations.map(async (location) => {
          const locationId = (location.id ?? "").trim();
          const locationSlug = (location.slug ?? "").trim();
          const businessId = (location.businessId ?? "").trim();
          const cfgQuery = new URLSearchParams();
          if (locationId) cfgQuery.set("locationId", locationId);
          if (locationSlug) cfgQuery.set("locationSlug", locationSlug);

          let serverConfig: ServerLocationConfig = {};
          let savedTheme: Partial<WidgetThemeSettings> | null = null;

          await Promise.all([
            (async () => {
              try {
                const cfgResponse = await fetch(`/api/location-config?${cfgQuery.toString()}`, { method: "GET" });
                if (cfgResponse.ok) {
                  const cfgPayload = (await cfgResponse.json().catch(() => ({}))) as { config?: Record<string, unknown> };
                  serverConfig = readServerLocationConfig(cfgPayload.config);
                }
              } catch {
                // best-effort
              }
            })(),

            (async () => {
              try {
                if (businessId && locationSlug) {
                  const themeParams = new URLSearchParams();
                  themeParams.set("businessId", businessId);
                  themeParams.set("locationSlug", locationSlug);
                  const themeResponse = await fetch(`/api/widget-theme?${themeParams.toString()}`, { method: "GET" });
                  if (themeResponse.ok) {
                    const themePayload = (await themeResponse.json().catch(() => ({}))) as { theme?: Partial<WidgetThemeSettings> };
                    if (themePayload.theme && typeof themePayload.theme === "object") {
                      savedTheme = themePayload.theme;
                    }
                  }
                }
              } catch {
                // best-effort
              }
            })(),
          ]);

          return {
            id: locationId,
            businessId,
            slug: locationSlug,
            name: (location.name ?? "").trim() || (serverConfig.legacyLocationName ?? ""),
            address: (location.address ?? "").trim() || (serverConfig.legacyAddress ?? ""),
            createdAt: location.createdAt,
            phone: serverConfig.phone,
            timezone: serverConfig.timezone,
            savedTheme,
            serverHours: serverConfig.hours,
            serverFaqs: serverConfig.faqs,
            serverHandoff: serverConfig.handoff,
          };
        }));

        if (cancelled) return;

        syncLocationsFromServer(
          snapshots.filter((e) => e.id && e.slug && e.name).map((e) => ({
            id: e.id, businessId: e.businessId, slug: e.slug,
            name: e.name, address: e.address, createdAt: e.createdAt,
            phone: e.phone, timezone: e.timezone,
          })),
        );

        // Apply rich config fields from Supabase to the mock-store so that
        // overview panels (HoursPanel, KnowledgePanel, HandoffPanel) show the
        // correct persisted state on page refresh.
        for (const snapshot of snapshots) {
          if (!snapshot.id) continue;

          const { serverHours, serverFaqs, serverHandoff, savedTheme: theme } = snapshot;
          const hasServerData = serverHours || serverFaqs || serverHandoff || theme;
          if (!hasServerData) continue;

          updateBusiness(snapshot.id, (draft) => {
            // Hours: server wins when Supabase has structured blocks (avoid blank override)
            if (serverHours && serverHours.length > 0) {
              draft.hours = serverHours;
            }
            // FAQs: server wins when Supabase has entries
            if (serverFaqs && serverFaqs.length > 0) {
              draft.faqs = serverFaqs;
            }
            // Handoff: merge server fields over local defaults so nothing is lost
            if (serverHandoff) {
              if (serverHandoff.contactMethods && serverHandoff.contactMethods.length > 0) {
                // Ensure every contact method has a stable id (Supabase JSONB records
                // saved before the id field was introduced will be missing it).
                draft.handoff.contactMethods = serverHandoff.contactMethods.map((c) =>
                  c.id ? c : { ...c, id: crypto.randomUUID() },
                );
              }
              if (serverHandoff.status) draft.handoff.status = serverHandoff.status;
              if (serverHandoff.headline) draft.handoff.headline = serverHandoff.headline;
              if (serverHandoff.statusDetail !== undefined) draft.handoff.statusDetail = serverHandoff.statusDetail;
              if (serverHandoff.supportHoursLabel !== undefined) draft.handoff.supportHoursLabel = serverHandoff.supportHoursLabel;
              if (serverHandoff.offlineMessage !== undefined) draft.handoff.offlineMessage = serverHandoff.offlineMessage;
            }
            // Theme
            if (theme) {
              draft.theme = normalizeWidgetTheme(Object.assign({}, draft.theme, theme));
            }
          });
        }

        if (debugLocation) {
          console.info("[location-debug] canonical hydration", {
            canonicalLocations: snapshots,
            activeLocationId: activeBusiness?.id ?? null,
          });
        }
      } catch {
        // Ignore hydration errors at layout level.
      } finally {
        if (!cancelled) {
          markLocationsFetched();
        }
      }
    };

    void hydrateLocations();
    return () => { cancelled = true; };
  }, [searchParams, activeBusiness?.id]);
}
