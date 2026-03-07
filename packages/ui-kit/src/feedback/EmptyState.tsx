import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-[var(--color-text-muted)]">{icon}</div>
      )}
      <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
