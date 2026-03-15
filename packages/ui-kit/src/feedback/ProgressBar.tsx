import { cn } from "../lib/cn";

export type ProgressBarProps = {
  /** 0–100 */
  value: number;
  /** Visual tone */
  tone?: "primary" | "success" | "warning" | "danger";
  /** Display size */
  size?: "sm" | "md";
  /** Optional label shown to the right */
  label?: string;
  className?: string;
};

const toneFill: Record<string, string> = {
  primary: "bg-[var(--color-primary)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
};

const sizeTrack: Record<string, string> = {
  sm: "h-1",
  md: "h-2",
};

export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  label,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-hover)]",
          sizeTrack[size],
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-[var(--radius-full)] transition-all duration-[var(--duration-normal)]",
            toneFill[tone],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && (
        <span className="shrink-0 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}
    </div>
  );
}
