import { cn } from "../lib/cn";

export type StatusPillProps = {
  label: string;
  status: "idle" | "running" | "success" | "error" | "warning" | "queued";
  /** Show animated pulse dot for active states */
  pulse?: boolean;
  className?: string;
};

const statusStyles: Record<string, { dot: string; bg: string; text: string }> = {
  idle: {
    dot: "bg-[var(--color-text-muted)]",
    bg: "bg-[var(--color-surface-hover)]",
    text: "text-[var(--color-text-secondary)]",
  },
  queued: {
    dot: "bg-[var(--color-info)]",
    bg: "bg-[var(--color-info-light)]",
    text: "text-[var(--color-info)]",
  },
  running: {
    dot: "bg-[var(--color-primary)]",
    bg: "bg-[var(--color-primary-light)]",
    text: "text-[var(--color-primary)]",
  },
  success: {
    dot: "bg-[var(--color-success)]",
    bg: "bg-[var(--color-success-light)]",
    text: "text-[var(--color-success)]",
  },
  error: {
    dot: "bg-[var(--color-danger)]",
    bg: "bg-[var(--color-danger-light)]",
    text: "text-[var(--color-danger)]",
  },
  warning: {
    dot: "bg-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-light)]",
    text: "text-[var(--color-warning)]",
  },
};

export function StatusPill({ label, status, pulse, className }: StatusPillProps) {
  const s = statusStyles[status];
  const showPulse = pulse ?? (status === "running" || status === "queued");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-0.5 text-[var(--text-xs)] font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {showPulse && (
          <span
            className={cn("absolute inline-flex h-full w-full animate-ping rounded-[var(--radius-full)] opacity-75", s.dot)}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-[var(--radius-full)]", s.dot)} />
      </span>
      {label}
    </span>
  );
}
