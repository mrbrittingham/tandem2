import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type StatCardProps = {
  /** Metric label */
  label: string;
  /** Primary metric value */
  value: string | number;
  /** Optional trend indicator (e.g. "+12%") */
  trend?: string;
  /** Trend direction for coloring */
  trendDirection?: "up" | "down" | "neutral";
  /** Optional status node (e.g. a Badge or StatusPill) */
  status?: ReactNode;
  /** Optional icon */
  icon?: ReactNode;
  className?: string;
};

const trendColors: Record<string, string> = {
  up: "text-[var(--color-success)]",
  down: "text-[var(--color-danger)]",
  neutral: "text-[var(--color-text-muted)]",
};

export function StatCard({
  label,
  value,
  trend,
  trendDirection = "neutral",
  status,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)]">
          {label}
        </span>
        {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">
          {value}
        </span>
        {trend && (
          <span className={cn("text-[var(--text-xs)] font-medium", trendColors[trendDirection])}>
            {trend}
          </span>
        )}
      </div>
      {status && <div className="mt-1">{status}</div>}
    </div>
  );
}
