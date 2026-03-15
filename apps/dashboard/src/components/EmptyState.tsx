'use client';

import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryHref,
  secondaryLabel,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--console-radius-lg)] border border-[var(--console-border)] bg-[var(--console-bg-card)] px-8 py-20 text-center text-[var(--console-text-primary)] shadow-[var(--console-shadow-sm)]"
      style={{ background: "radial-gradient(ellipse at 50% 0%, var(--color-primary-light) 0%, var(--color-surface) 60%)" }}
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
        <svg className="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--console-text-primary)]">{title}</h2>
      <p className="mt-2 max-w-xl text-base text-[var(--console-text-secondary)]">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white shadow-sm shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] active:bg-[var(--color-primary-pressed)]"
          >
            {actionLabel}
          </button>
        )}
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-text)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-surface-hover)]"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
