"use client";

import type { BusinessProfile, OperatingHoursBlock } from "@tandem/shared";

type Props = {
  location: BusinessProfile;
  onPromptChip: (prompt: string) => void;
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function formatTime(t: string) {
  // Accept "HH:MM" or "HH:MM:SS" and format as "12:00 PM"
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? 0);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function normalizeDays(days: string[]): string[] {
  return days
    .map((d) => DAY_SHORT[d] ?? d)
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function groupHoursBlocks(blocks: OperatingHoursBlock[]) {
  // Group blocks by open+close pair label
  const rows: { days: string[]; open: string; close: string }[] = [];

  for (const block of blocks) {
    const existing = rows.find(
      (r) => r.open === block.open && r.close === block.close,
    );
    const normalizedDays = normalizeDays(block.days);
    if (existing) {
      existing.days = normalizeDays([...existing.days, ...normalizedDays]);
    } else {
      rows.push({ days: normalizedDays, open: block.open, close: block.close });
    }
  }

  return rows.sort((a, b) => DAY_ORDER.indexOf(a.days[0]) - DAY_ORDER.indexOf(b.days[0]));
}

function formatDayRange(days: string[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return days[0];

  // Try to build a compact range like "Mon–Fri" if consecutive
  const indices = days.map((d) => DAY_ORDER.indexOf(d));
  const isConsecutive = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
  if (isConsecutive && days.length > 2) {
    return `${days[0]}–${days[days.length - 1]}`;
  }
  return days.join(", ");
}

export function HoursPanel({ location, onPromptChip }: Props) {
  const blocks = location.hours ?? [];
  const hasBlocks = blocks.length > 0;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Operating Hours</h2>
        {hasBlocks && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Configured
          </span>
        )}
      </div>

      {hasBlocks ? (
        <div className="space-y-1.5">
          {groupHoursBlocks(blocks).map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 odd:bg-[var(--color-bg)]"
            >
              <span className="text-sm text-[var(--color-text-secondary)]">
                {formatDayRange(row.days)}
              </span>
              <span className="text-sm font-medium text-[var(--color-text)] tabular-nums">
                {formatTime(row.open)} – {formatTime(row.close)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5">
          <p className="text-sm font-medium text-orange-800">Hours not configured</p>
          <p className="mt-1 text-xs text-orange-700 leading-relaxed">
            Your chatbot will tell guests it doesn&apos;t know your hours.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <PromptChip
          label="Update my hours"
          onClick={() =>
            onPromptChip('Update my operating hours to "')
          }
        />
      </div>
    </div>
  );
}

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
