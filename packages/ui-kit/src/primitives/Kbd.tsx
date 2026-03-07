import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type KbdProps = {
  children: ReactNode;
  className?: string;
};

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-[var(--radius-xs)] " +
          "border border-[var(--color-border)] bg-[var(--color-surface-hover)] " +
          "px-1 font-[var(--font-mono)] text-[10px] font-medium text-[var(--color-text-muted)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
