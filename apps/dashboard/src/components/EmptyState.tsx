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
    <div className="flex flex-col items-center justify-center rounded-[var(--console-radius-lg)] border border-[var(--console-border)] bg-[var(--console-bg-card)] px-8 py-16 text-center text-[var(--console-text-primary)] shadow-[var(--console-shadow-sm)]">
      <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">Get started</p>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--console-text-primary)]">{title}</h2>
      <p className="mt-2 max-w-xl text-base text-[var(--console-text-secondary)]">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-[var(--console-radius-md)] bg-[var(--console-primary)] px-6 py-3 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
          >
            {actionLabel}
          </button>
        )}
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="rounded-[var(--console-radius-md)] border border-[var(--console-border)] px-6 py-3 text-sm font-semibold text-[var(--console-text-secondary)] transition hover:bg-[var(--console-bg-hover)]"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
