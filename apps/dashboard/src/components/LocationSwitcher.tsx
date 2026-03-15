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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full max-w-[320px] items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary-light)] text-[10px] font-bold text-[var(--color-primary)]">
          {(safeTitle[0] ?? "L").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--color-text)]" suppressHydrationWarning>{safeTitle}</p>
          <p className="truncate text-[var(--text-xs)] text-[var(--color-text-muted)]" suppressHydrationWarning>{safeAddress}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--color-text-muted)]">
          <path d="M4.5 6.5 8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]">
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  selectActiveLocation(location.id);
                  setOpen(false);
                }}
                className={`w-full cursor-pointer rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--text-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  location.id === activeLocation?.id
                    ? "bg-[var(--color-primary-light)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text)]">{deriveLocationName(location)}</p>
                    <p className="truncate text-[var(--text-xs)] text-[var(--color-text-muted)]">{deriveStreetAddress(location)}</p>
                  </div>
                  {location.id === activeLocation?.id ? (
                    <span className="shrink-0 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-white">Active</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-1 space-y-0.5 border-t border-[var(--color-border-subtle)] pt-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddLocation();
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 3v8M3 7h8" /></svg>
              Add location
            </button>
            <Link
              href="/locations"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v5M9.5 7h-5" /></svg>
              Manage locations
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
