import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type CardProps = {
  children: ReactNode;
  className?: string;
  /** Optional padding override. Defaults to p-5. */
  padding?: string;
};

export function Card({ children, className, padding }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-xs)]",
        padding ?? "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
