import { type ReactNode } from "react";
import { cn } from "../lib/cn";

const tones: Record<string, string> = {
  neutral:
    "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]",
  primary:
    "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  success:
    "bg-[var(--color-success-light)] text-[var(--color-success)]",
  warning:
    "bg-[var(--color-warning-light)] text-amber-700",
  danger:
    "bg-[var(--color-danger-light)] text-[var(--color-danger)]",
  info:
    "bg-[var(--color-info-light)] text-[var(--color-info)]",
};

export type BadgeProps = {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-[var(--text-xs)] font-medium leading-tight",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
