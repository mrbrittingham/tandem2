import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type ActivityFeedItemProps = {
  /** Icon/avatar to show in the timeline gutter */
  icon?: ReactNode;
  /** Primary text */
  title: ReactNode;
  /** Secondary metadata (user, category, etc.) */
  meta?: ReactNode;
  /** Timestamp string */
  timestamp?: string;
  /** Additional content below the title */
  children?: ReactNode;
};

export type ActivityFeedProps = {
  items: ActivityFeedItemProps[];
  className?: string;
};

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      {items.map((item, i) => (
        <div key={i} className="relative flex gap-3 pb-6 last:pb-0">
          {/* Timeline line */}
          {i < items.length - 1 && (
            <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--color-border)]" />
          )}

          {/* Icon gutter */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {item.icon ?? (
              <div className="h-2 w-2 rounded-[var(--radius-full)] bg-[var(--color-text-muted)]" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                {item.title}
              </span>
              {item.timestamp && (
                <time className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {item.timestamp}
                </time>
              )}
            </div>
            {item.meta && (
              <div className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                {item.meta}
              </div>
            )}
            {item.children && <div className="mt-2">{item.children}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
