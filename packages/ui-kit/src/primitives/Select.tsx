import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const base =
  "flex w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] " +
  "bg-[var(--color-surface)] px-3 pr-8 text-[var(--text-base)] text-[var(--color-text)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-transparent " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-colors " +
  "bg-[length:16px_16px] bg-[position:right_8px_center] bg-no-repeat " +
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")]";

const sizes: Record<string, string> = {
  sm: "h-[var(--control-height-sm)] text-[var(--text-sm)]",
  md: "h-[var(--control-height-md)] text-[var(--text-base)]",
  lg: "h-[var(--control-height-lg)] text-[var(--text-base)]",
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  selectSize?: "sm" | "md" | "lg";
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ selectSize = "md", className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(base, sizes[selectSize], className)}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
