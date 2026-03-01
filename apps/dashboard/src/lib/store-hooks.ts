'use client';

import { useSyncExternalStore } from "react";
import {
  businessToWidgetConfig,
  createBusiness,
  getActiveBusiness,
  getMockState,
  selectActiveBusiness,
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
  return snapshot.businesses;
}

export { businessToWidgetConfig, createBusiness, selectActiveBusiness, updateBusiness };
