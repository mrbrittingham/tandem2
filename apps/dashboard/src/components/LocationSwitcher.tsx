'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { selectActiveLocation, useActiveLocation, useLocations } from "@/lib/store-hooks";
import type { BusinessProfile } from "@tandem/shared";

type Props = {
  onAddLocation: () => void;
};

function deriveLocationName(location?: BusinessProfile) {
  if (!location) {
    return "Location";
  }

  const fromLocationName = (location.locationName ?? "").trim();
  if (fromLocationName) {
    return fromLocationName;
  }

  const fromName = (location.name ?? "").trim();
  if (fromName) {
    return fromName;
  }

  const fromBusinessName = (location.businessName ?? "").trim();
  if (fromBusinessName) {
    return fromBusinessName;
  }

  const address = (location.location ?? "").trim();
  if (address) {
    const head = address.split(",")[0]?.trim();
    if (head) {
      return head;
    }
  }

  const suffix = location.id.slice(-4).toUpperCase();
  return `Location ${suffix}`;
}

function deriveStreetAddress(location?: BusinessProfile) {
  const address = (location?.location ?? "").trim();
  if (!address) {
    return "Address not set";
  }

  const street = address.split(",")[0]?.trim();
  return street || "Address not set";
}

export function LocationSwitcher({ onAddLocation }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const activeLocation = useActiveLocation();
  const locations = useLocations();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const activeTitle = useMemo(() => deriveLocationName(activeLocation), [activeLocation]);
  const activeAddress = useMemo(() => deriveStreetAddress(activeLocation), [activeLocation]);

  const safeTitle = mounted ? activeTitle : "…";
  const safeAddress = mounted ? activeAddress : "…";

  return (
    <div className="relative">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Location</p>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-1 w-full max-w-[360px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-900 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-primary)]/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900" suppressHydrationWarning>{safeTitle}</p>
            <p className="text-xs text-slate-500" suppressHydrationWarning>{safeAddress}</p>
          </div>
          <span aria-hidden="true" className="pt-0.5 text-slate-500">▾</span>
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  selectActiveLocation(location.id);
                  setOpen(false);
                }}
                className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-primary)]/30 ${
                  location.id === activeLocation?.id
                    ? "border border-blue-200 bg-blue-50 text-slate-900"
                    : "border border-transparent text-slate-800 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{deriveLocationName(location)}</p>
                    <p className="text-sm text-slate-500">{deriveStreetAddress(location)}</p>
                  </div>
                  {location.id === activeLocation?.id ? (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">Current</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-1 space-y-1 border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddLocation();
              }}
              className="block w-full rounded-md bg-white px-3 py-2 text-left text-sm font-medium !text-slate-700 transition-colors duration-150 hover:bg-blue-50 hover:!text-slate-900"
            >
              Add location
            </button>
            <Link
              href="/locations"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium !text-slate-600 transition-colors duration-150 hover:bg-blue-50 hover:!text-blue-600"
            >
              Manage locations
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
