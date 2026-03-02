'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { selectActiveLocation, useAccountBusiness, useActiveLocation, useLocations } from "@/lib/store-hooks";

type Props = {
  onAddLocation: () => void;
};

export function LocationSwitcher({ onAddLocation }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const accountBusiness = useAccountBusiness();
  const activeLocation = useActiveLocation();
  const locations = useLocations();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const locationLabel = useMemo(() => {
    return activeLocation?.locationName ?? activeLocation?.location ?? "Select location";
  }, [activeLocation]);

  const safeLocationLabel = mounted ? locationLabel : "…";
  const businessName = accountBusiness.name ?? "Business";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--console-bg-card)] px-3 text-[var(--console-text-sm)] font-medium text-[var(--console-text-primary)] transition hover:bg-[var(--console-bg-hover)]"
      >
        <span className="max-w-[180px] truncate" suppressHydrationWarning>{businessName} · {safeLocationLabel}</span>
        <span className="text-[var(--console-text-tertiary)]">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--console-bg-card)] p-2 shadow-[var(--console-shadow-lg)]">
          <div className="max-h-60 overflow-y-auto">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  selectActiveLocation(location.id);
                  setOpen(false);
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  location.id === activeLocation?.id
                    ? "bg-[var(--console-primary-light)] text-[var(--console-primary)]"
                    : "text-[var(--console-text-secondary)] hover:bg-[var(--console-bg-hover)]"
                }`}
              >
                <p className="font-semibold">{location.locationName ?? location.location}</p>
                <p className="text-xs text-[var(--console-text-tertiary)]">{location.location || "No address"}</p>
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-[var(--console-border-light)] pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddLocation();
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--console-primary)] hover:bg-[var(--console-primary-light)]"
            >
              + Add location
            </button>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-[var(--console-text-secondary)] hover:bg-[var(--console-bg-hover)]"
            >
              Manage locations
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
