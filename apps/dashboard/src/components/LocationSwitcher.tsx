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

  return (
    <div className="relative">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Business</p>
      <p className="text-lg font-semibold text-slate-900">{accountBusiness.name ?? "Business"}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm text-slate-500" suppressHydrationWarning>{(accountBusiness.name ?? "Business")} • {safeLocationLabel}</p>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          {safeLocationLabel}
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
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
                  location.id === activeLocation?.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <p className="font-semibold">{location.locationName ?? location.location}</p>
                <p className="text-xs text-slate-500">{location.location || "No address"}</p>
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddLocation();
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              + Add location
            </button>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Manage locations
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
