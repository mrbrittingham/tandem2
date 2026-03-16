"use client";

import type { WebsiteImportDraft } from "@/lib/website-import/types";

type Props = {
  draft: WebsiteImportDraft;
  onApply: () => void;
  onReview: () => void;
  isApplying?: boolean;
};

type CategoryCardProps = {
  icon: string;
  label: string;
  found: boolean;
  detail?: string;
};

function CategoryCard({ icon, label, found, detail }: CategoryCardProps) {
  return (
    <div
      className={`rounded-[var(--console-radius-md)] border p-4 ${
        found
          ? "border-emerald-200 bg-emerald-50"
          : "border-orange-200 bg-orange-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-semibold text-[var(--console-text-primary)]">{label}</span>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            found
              ? "bg-emerald-200 text-emerald-800"
              : "bg-orange-200 text-orange-800"
          }`}
        >
          {found ? "Found" : "Not found"}
        </span>
      </div>
      {detail ? (
        <p className="mt-1.5 text-xs text-[var(--console-text-secondary)] line-clamp-2">{detail}</p>
      ) : null}
    </div>
  );
}

/**
 * Right-panel component for Stage 3 (scan results).
 * Shows category cards with found/not-found state for each knowledge type.
 */
export function ScanResultsSummary({ draft, onApply, onReview, isApplying = false }: Props) {
  const hasHours = Boolean(draft.businessProfile.hours.value);
  const menuCount = draft.restaurantKnowledge.menuSections.filter((s) => s.include).length;
  const faqCount = draft.faqs.filter((f) => f.include).length;
  const hasPhone = Boolean(draft.businessProfile.phone.value);
  const hasEmail = Boolean(draft.businessProfile.email.value);
  const hasBooking = Boolean(draft.restaurantKnowledge.reservations.bookingUrl);
  const hasContact = hasPhone || hasEmail || hasBooking;
  const hasBrand = Boolean(draft.brand.primaryColor.value) || Boolean(draft.brand.logoUrl.value);

  const menuDetail = menuCount > 0
    ? `${menuCount} section${menuCount === 1 ? "" : "s"}, ${draft.restaurantKnowledge.menuSections
        .filter((s) => s.include)
        .slice(0, 2)
        .map((s) => s.title)
        .join(", ")}${menuCount > 2 ? "…" : ""}`
    : undefined;

  const contactDetail = [
    draft.businessProfile.phone.value,
    draft.businessProfile.email.value,
  ]
    .filter(Boolean)
    .join(" · ") || undefined;

  const brandDetail = [
    draft.brand.primaryColor.value ? `Color: ${draft.brand.primaryColor.value}` : null,
    draft.brand.logoUrl.value ? "Logo found" : null,
  ]
    .filter(Boolean)
    .join(" · ") || undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--console-text-tertiary)]">
          Scan complete
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--console-text-primary)]">
          What I learned about your restaurant
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CategoryCard
          icon="🕐"
          label="Hours"
          found={hasHours}
          detail={hasHours ? draft.businessProfile.hours.value ?? undefined : undefined}
        />
        <CategoryCard
          icon="📋"
          label="Menu"
          found={menuCount > 0}
          detail={menuDetail}
        />
        <CategoryCard
          icon="❓"
          label="Q&As"
          found={faqCount > 0}
          detail={faqCount > 0 ? `${faqCount} question${faqCount === 1 ? "" : "s"} found` : undefined}
        />
        <CategoryCard
          icon="📞"
          label="Contact"
          found={hasContact}
          detail={contactDetail}
        />
        <CategoryCard
          icon="🎨"
          label="Brand"
          found={hasBrand}
          detail={brandDetail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="w-full rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isApplying ? "Applying…" : "✓ Yes, set this up"}
        </button>
        <button
          type="button"
          onClick={onReview}
          disabled={isApplying}
          className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-hover)] hover:text-[var(--console-text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Review details first
        </button>
      </div>
    </div>
  );
}
