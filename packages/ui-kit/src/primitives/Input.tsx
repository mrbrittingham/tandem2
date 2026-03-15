import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const base =
  "flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] " +
  "bg-[var(--color-surface)] px-3 text-[var(--text-base)] text-[var(--color-text)] " +
  "placeholder:text-[var(--color-text-muted)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-[var(--color-primary)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-colors";

const sizes: Record<string, string> = {
  sm: "h-[var(--control-height-sm)] text-[var(--text-sm)]",
  md: "h-[var(--control-height-md)] text-[var(--text-base)]",
  lg: "h-[var(--control-height-lg)] text-[var(--text-base)]",
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: "sm" | "md" | "lg";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(base, sizes[inputSize], className)}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
