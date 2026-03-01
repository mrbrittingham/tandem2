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
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-8 py-16 text-center text-slate-900 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Get started</p>
      <h2 className="mt-4 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-xl text-base text-slate-500">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {actionLabel}
          </button>
        )}
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
