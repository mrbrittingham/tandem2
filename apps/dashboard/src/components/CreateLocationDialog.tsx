'use client';

import { useMemo, useState } from "react";
import { createLocation, useLocations } from "@/lib/store-hooks";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Mode = "fresh" | "copy";

export function CreateLocationDialog({ open, onClose }: Props) {
  const locations = useLocations();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<Mode>("fresh");
  const [sourceLocationId, setSourceLocationId] = useState("");

  const reset = () => {
    setStep(1);
    setName("");
    setAddress("");
    setMode("fresh");
    setSourceLocationId("");
  };

  const sourceOptions = useMemo(
    () => locations.map((location) => ({ id: location.id, label: location.locationName ?? location.location })),
    [locations],
  );

  if (!open) {
    return null;
  }

  const selectedSourceLocationId = sourceLocationId || sourceOptions[0]?.id || "";
  const canContinue = Boolean(name.trim());
  const canCreate = mode === "fresh" || Boolean(selectedSourceLocationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(15,23,42,0.6)] px-4 py-6">
      <div className="w-full max-w-2xl rounded-[var(--console-radius-lg)] border border-[var(--console-border)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-shadow-xl)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">Location setup</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--console-text-primary)]">Add location</h2>
            <p className="text-sm text-[var(--console-text-secondary)]">Create a new location from scratch or copy an existing location setup.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-3 py-1.5 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:bg-[var(--console-bg-hover)]"
          >
            Close
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-4">
            <label className="flex flex-col gap-2 text-sm text-[var(--console-text-secondary)]">
              <span className="font-semibold text-[var(--console-text-primary)]">Location name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Valencia St"
                className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-4 py-3 text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-[var(--console-text-secondary)]">
              <span className="font-semibold text-[var(--console-text-primary)]">Address (optional)</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="980 Valencia St, San Francisco"
                className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-4 py-3 text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep(2)}
                className="rounded-[var(--console-radius-md)] bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("fresh")}
                className={`rounded-[var(--console-radius-md)] border px-4 py-3 text-left ${
                  mode === "fresh"
                    ? "border-[var(--console-primary)] bg-[var(--console-primary-light)]"
                    : "border-[var(--console-border)] bg-[var(--console-bg-card)]"
                }`}
              >
                <p className="text-sm font-semibold text-[var(--console-text-primary)]">Start fresh</p>
                <p className="text-xs text-[var(--console-text-secondary)]">Create an empty location with default assistant and settings.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("copy")}
                className={`rounded-[var(--console-radius-md)] border px-4 py-3 text-left ${
                  mode === "copy"
                    ? "border-[var(--console-primary)] bg-[var(--console-primary-light)]"
                    : "border-[var(--console-border)] bg-[var(--console-bg-card)]"
                }`}
              >
                <p className="text-sm font-semibold text-[var(--console-text-primary)]">Copy from…</p>
                <p className="text-xs text-[var(--console-text-secondary)]">Clone assistant config, FAQs, policies, handoff, widget, and integrations.</p>
              </button>
            </div>

            {mode === "copy" ? (
              <label className="flex flex-col gap-2 text-sm text-[var(--console-text-secondary)]">
                <span className="font-semibold text-[var(--console-text-primary)]">Source location</span>
                <select
                  value={selectedSourceLocationId}
                  onChange={(event) => setSourceLocationId(event.target.value)}
                  className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-4 py-3 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
                >
                  {sourceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-4 py-2 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:bg-[var(--console-bg-hover)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => {
                  createLocation({
                    name,
                    address,
                    mode,
                    sourceLocationId: mode === "copy" ? selectedSourceLocationId : undefined,
                  });
                  reset();
                  onClose();
                }}
                className="rounded-[var(--console-radius-md)] bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
