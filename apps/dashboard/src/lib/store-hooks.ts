'use client';

import { useSyncExternalStore, useState, useEffect } from "react";
import { subscribeToConfigStore, getConfigStoreState } from "@/lib/config-store";
import {
  businessToWidgetConfig,
  createBusiness,
  createLocation,
  updateMockState,
  getActiveLocation,
  getActiveBusiness,
  getLocations,
  getMockState,
  selectActiveBusiness,
  selectActiveLocation,
  subscribeToMockState,
  updateBusiness,
  type BusinessProfile,
  type MockState,
} from "@tandem/shared";

export function useConsoleStore(): MockState {
  return useSyncExternalStore(subscribeToMockState, getMockState, getMockState);
}

export function useActiveBusiness(): BusinessProfile | undefined {
  const snapshot = useConsoleStore();
  return getActiveBusiness(snapshot);
}

export function useBusinesses(): BusinessProfile[] {
  const snapshot = useConsoleStore();
  return getLocations(snapshot);
}

export function useActiveLocation(): BusinessProfile | undefined {
  const snapshot = useConsoleStore();
  return getActiveLocation(snapshot);
}

export function useLocations(): BusinessProfile[] {
  const snapshot = useConsoleStore();
  return getLocations(snapshot);
}

/**
 * Returns false on the server and during React's first client render,
 * then flips to true after mount. Use this to avoid showing "No location"
 * EmptyState while localStorage is still being read into the store.
 */
export function useIsStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

// ─── Server-fetch completion flag ────────────────────────────────────────────
// Tracks whether the initial /api/locations fetch has resolved (success or
// failure). Use this to avoid showing "No location" empty state while the
// first network round-trip is in flight.

let _locationsFetched = false;
const _locationsFetchedListeners = new Set<() => void>();

export function markLocationsFetched() {
  _locationsFetched = true;
  for (const fn of _locationsFetchedListeners) fn();
}

export function useIsLocationsServerFetched(): boolean {
  return useSyncExternalStore(
    (callback) => {
      _locationsFetchedListeners.add(callback);
      return () => { _locationsFetchedListeners.delete(callback); };
    },
    () => _locationsFetched,
    () => false,
  );
}

export function useAccountBusiness() {
  const snapshot = useConsoleStore();
  return {
    name: snapshot.accountBusinessName ?? getActiveBusiness(snapshot)?.businessName ?? getActiveBusiness(snapshot)?.name,
    slug: snapshot.accountBusinessSlug ?? getActiveBusiness(snapshot)?.businessSlug,
  };
}

type ServerLocationSnapshot = {
  id: string;
  businessId: string;
  slug: string;
  name: string;
  address: string;
  createdAt?: string;
  phone?: string;
  timezone?: string;
};

function defaultTheme() {
  return {
    primaryColor: "#3170FC",
    accentColor: "#9E4770",
    surfaceColor: "#FFFFFF",
    textPrimaryColor: "#0F172A",
    textSecondaryColor: "#475569",
    fontFamily: "'Inter', sans-serif",
  };
}

function createShellLocation(snapshot: ServerLocationSnapshot): BusinessProfile {
  const timestamp = snapshot.createdAt ?? new Date().toISOString();
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    name: snapshot.name,
    locationName: snapshot.name,
    locationSlug: snapshot.slug,
    businessName: snapshot.name,
    businessSlug: snapshot.businessId,
    industry: "restaurant",
    timezone: snapshot.timezone ?? "UTC",
    tagline: "",
    summary: "",
    location: snapshot.address,
    contacts: [],
    hours: [],
    intents: [],
    faqs: [],
    policies: [],
    integrations: [],
    theme: defaultTheme(),
    handoff: {
      headline: "Support",
      status: "offline",
      statusDetail: "",
      supportHoursLabel: "",
      contactMethods: [],
      offlineMessage: "",
    },
    createdAt: timestamp,
    updatedAt: new Date().toISOString(),
  };
}

function upsertPhone(location: BusinessProfile, phoneValue: string) {
  const phone = phoneValue.trim();
  const existingContactPhone = location.contacts.find((entry) => entry.type === "phone");
  if (phone) {
    if (existingContactPhone) {
      existingContactPhone.value = phone;
      existingContactPhone.enabled = true;
    } else {
      location.contacts.unshift({
        id: crypto.randomUUID(),
        type: "phone",
        label: "Front desk",
        value: phone,
        enabled: true,
      });
    }
  } else if (existingContactPhone) {
    existingContactPhone.enabled = false;
  }

  const existingHandoffPhone = location.handoff.contactMethods.find((entry) => entry.type === "phone");
  if (phone) {
    if (existingHandoffPhone) {
      existingHandoffPhone.value = phone;
      existingHandoffPhone.enabled = true;
    } else {
      location.handoff.contactMethods.unshift({
        id: crypto.randomUUID(),
        type: "phone",
        label: "Phone",
        value: phone,
        enabled: true,
      });
    }
  } else if (existingHandoffPhone) {
    existingHandoffPhone.enabled = false;
  }
}

export function syncLocationsFromServer(snapshots: ServerLocationSnapshot[]) {
  updateMockState((draft) => {
    const existingById = new Map(draft.businesses.map((entry) => [entry.id, entry]));
    const existingBySlug = new Map(draft.businesses.map((entry) => [entry.locationSlug ?? entry.slug, entry]));

    draft.businesses = snapshots.map((snapshot) => {
      const existing = existingById.get(snapshot.id)
        ?? existingBySlug.get(snapshot.slug)
        ?? draft.businesses[0]
        ?? createShellLocation(snapshot);

      const next = JSON.parse(JSON.stringify(existing)) as BusinessProfile;
      next.id = snapshot.id;
      next.slug = snapshot.slug;
      next.locationSlug = snapshot.slug;
      next.name = snapshot.name;
      next.locationName = snapshot.name;
      next.location = snapshot.address;
      next.timezone = snapshot.timezone?.trim() || next.timezone || "UTC";
      next.businessSlug = next.businessSlug || snapshot.businessId;
      next.businessName = next.businessName || next.name;
      if (snapshot.createdAt) {
        next.createdAt = snapshot.createdAt;
      }
      upsertPhone(next, snapshot.phone ?? "");
      next.updatedAt = new Date().toISOString();
      return next;
    });

    const currentActive = draft.activeLocationId ?? draft.activeBusinessId;
    const hasCurrent = draft.businesses.some((entry) => entry.id === currentActive);
    const nextActive = hasCurrent ? currentActive : draft.businesses[0]?.id;

    draft.activeLocationId = nextActive;
    draft.activeBusinessId = nextActive;
    if (draft.businesses[0]) {
      draft.accountBusinessName = draft.businesses[0].businessName ?? draft.businesses[0].name;
      draft.accountBusinessSlug = draft.businesses[0].businessSlug;
    }
  });
}

function removeLocation(locationId: string) {
  updateMockState((draft) => {
    const nextLocations = draft.businesses.filter((entry) => entry.id !== locationId);
    draft.businesses = nextLocations;

    const currentActive = draft.activeLocationId ?? draft.activeBusinessId;
    if (currentActive === locationId) {
      const replacement = nextLocations[0]?.id;
      draft.activeLocationId = replacement;
      draft.activeBusinessId = replacement;
    }

    if (!nextLocations.length) {
      draft.activeLocationId = undefined;
      draft.activeBusinessId = undefined;
      draft.accountBusinessName = undefined;
      draft.accountBusinessSlug = undefined;
      return;
    }

    if (!draft.activeLocationId) {
      draft.activeLocationId = nextLocations[0].id;
    }
    if (!draft.activeBusinessId) {
      draft.activeBusinessId = draft.activeLocationId;
    }

    draft.accountBusinessName = nextLocations[0].businessName ?? nextLocations[0].name;
    draft.accountBusinessSlug = nextLocations[0].businessSlug;
  });
}

export {
  businessToWidgetConfig,
  createBusiness,
  createLocation,
  removeLocation,
  selectActiveBusiness,
  selectActiveLocation,
  updateBusiness,
};

export function useConfigStoreVersion(): number {
  return useSyncExternalStore(
    subscribeToConfigStore,
    () => getConfigStoreState().version,
    () => 0,
  );
}
