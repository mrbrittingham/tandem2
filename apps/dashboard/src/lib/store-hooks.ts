'use client';

import { useSyncExternalStore } from "react";
import {
  businessToWidgetConfig,
  createBusiness,
  createLocation,
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
  return getActiveLocation(snapshot);
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

export function useAccountBusiness() {
  const snapshot = useConsoleStore();
  return {
    name: snapshot.accountBusinessName ?? getActiveBusiness(snapshot)?.businessName ?? getActiveBusiness(snapshot)?.name,
    slug: snapshot.accountBusinessSlug ?? getActiveBusiness(snapshot)?.businessSlug,
  };
}

export {
  businessToWidgetConfig,
  createBusiness,
  createLocation,
  selectActiveBusiness,
  selectActiveLocation,
  updateBusiness,
};
