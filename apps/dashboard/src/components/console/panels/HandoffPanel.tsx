"use client";

import Link from "next/link";
import type { BusinessProfile, ContactMethod } from "@tandem/shared";

type Props = {
  location: BusinessProfile;
  onPromptChip: (prompt: string) => void;
};

function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      {label}
    </button>
  );
}

function typeIcon(type: ContactMethod["type"]): string {
  switch (type) {
    case "phone": return "📞";
    case "email": return "📧";
    case "sms": return "💬";
    case "link": return "🔗";
    case "form": return "📋";
    default: return "📌";
  }
}

export function HandoffPanel({ location, onPromptChip }: Props) {
  const handoff = location.handoff;
  const allMethods = handoff?.contactMethods ?? [];
  const enabledMethods = allMethods.filter((c) => c.enabled);
  const disabledMethods = allMethods.filter((c) => !c.enabled);
  const isOnline = handoff?.status === "online";

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Handoff Contacts</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isOnline
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        {allMethods.length > 0 && (
          <Link
            href="/handoff"
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            See all →
          </Link>
        )}
      </div>

      {allMethods.length === 0 ? (
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5">
          <p className="text-sm font-medium text-orange-800">No handoff contacts configured</p>
          <p className="mt-1 text-xs text-orange-700 leading-relaxed">
            Guests cannot reach your team directly from the chatbot.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {enabledMethods.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden>{typeIcon(c.type)}</span>
              <span className="font-medium text-[var(--color-text)]">{c.label}</span>
              <span className="ml-auto truncate text-[var(--color-text-secondary)]">{c.value}</span>
            </li>
          ))}
          {disabledMethods.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm opacity-40">
              <span aria-hidden>{typeIcon(c.type)}</span>
              <span className="text-[var(--color-text)]">{c.label}</span>
              <span className="ml-auto text-[var(--color-text-secondary)]">Disabled</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <PromptChip
          label="Add a contact"
          onClick={() => onPromptChip("Add a handoff contact: ")}
        />
        <PromptChip
          label="Set my status"
          onClick={() => onPromptChip("Set my handoff status to ")}
        />
      </div>
    </div>
  );
}
