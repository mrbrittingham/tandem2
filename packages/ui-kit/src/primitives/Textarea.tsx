import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const base =
  "flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] " +
  "bg-[var(--color-surface)] px-3 py-2 text-[var(--text-base)] text-[var(--color-text)] " +
  "placeholder:text-[var(--color-text-muted)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-transparent " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "resize-y min-h-[80px] transition-colors";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(base, className)}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
