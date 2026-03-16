"use client";

import type { BusinessProfile } from "@tandem/shared";

type Props = {
  location: BusinessProfile;
};

/** Health summary bar — three inline status badges showing critical config state. */
export function HealthSummaryBar({ location }: Props) {
  const hoursOk = (location.hours?.length ?? 0) > 0;
  const knowledgeOk = (location.faqs?.length ?? 0) > 0;
  const handoffOk = (location.handoff?.contactMethods ?? []).some((c) => c.enabled);

  const badges = [
    {
      label: "Hours",
      ok: hoursOk,
      okTip: "Hours configured",
      warnTip: "Hours not configured",
    },
    {
      label: "Knowledge",
      ok: knowledgeOk,
      okTip: "Q&As present",
      warnTip: "No Q&As yet",
    },
    {
      label: "Handoff",
      ok: handoffOk,
      okTip: "Contact method active",
      warnTip: "No active contact",
    },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.ok ? b.okTip : b.warnTip}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            b.ok
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${b.ok ? "bg-emerald-500" : "bg-orange-500"}`}
            aria-hidden
          />
          {b.label}{" "}
          {b.ok ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <circle cx="5.5" cy="5.5" r="5.5" fill="currentColor" fillOpacity="0.15" />
              <path d="M3 5.5 5 7.5 8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <circle cx="5.5" cy="5.5" r="5.5" fill="currentColor" fillOpacity="0.15" />
              <path d="M5.5 3v3M5.5 8v0.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
