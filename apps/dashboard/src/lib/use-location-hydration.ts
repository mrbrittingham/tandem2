"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { syncLocationsFromServer, useActiveLocation } from "@/lib/store-hooks";

function readBusinessProfile(value: unknown): { phone?: string; timezone?: string; legacyLocationName?: string; legacyAddress?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const root = value as Record<string, unknown>;
  const knowledgeConfig = root.knowledgeConfig;
  if (typeof knowledgeConfig !== "object" || knowledgeConfig === null || Array.isArray(knowledgeConfig)) return {};
  const businessProfile = (knowledgeConfig as Record<string, unknown>).businessProfile;
  if (typeof businessProfile !== "object" || businessProfile === null || Array.isArray(businessProfile)) return {};
  const profile = businessProfile as Record<string, unknown>;
  const str = (key: string) => {
    const v = profile[key];
    return typeof v === "string" && v.trim().length ? v.trim() : undefined;
  };
  return { phone: str("phone"), timezone: str("timezone"), legacyLocationName: str("locationName"), legacyAddress: str("address") };
}

/**
 * Hydrates locations from the server on mount and whenever search params change.
 * Extracted from the console layout to reduce component size.
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
          const query = new URLSearchParams();
          if (locationId) query.set("locationId", locationId);
          if (locationSlug) query.set("locationSlug", locationSlug);

          let businessProfile: ReturnType<typeof readBusinessProfile> = {};
          try {
            const cfgResponse = await fetch(`/api/location-config?${query.toString()}`, { method: "GET" });
            if (cfgResponse.ok) {
              const cfgPayload = (await cfgResponse.json().catch(() => ({}))) as { config?: Record<string, unknown> };
              businessProfile = readBusinessProfile(cfgPayload.config);
            }
          } catch {
            // Keep hydration best-effort.
          }

          return {
            id: locationId,
            businessId: (location.businessId ?? "").trim(),
            slug: locationSlug,
            name: (location.name ?? "").trim() || (businessProfile.legacyLocationName ?? ""),
            address: (location.address ?? "").trim() || (businessProfile.legacyAddress ?? ""),
            createdAt: location.createdAt,
            phone: businessProfile.phone,
            timezone: businessProfile.timezone,
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

        if (debugLocation) {
          console.info("[location-debug] canonical hydration", {
            canonicalLocations: snapshots,
            activeLocationId: activeBusiness?.id ?? null,
          });
        }
      } catch {
        // Ignore hydration errors at layout level.
      }
    };

    void hydrateLocations();
    return () => { cancelled = true; };
  }, [searchParams, activeBusiness?.id]);
}
