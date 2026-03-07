import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<string, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-pressed)]",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:bg-red-600 active:bg-red-700",
  link:
    "text-[var(--color-primary)] underline-offset-4 hover:underline",
};

const sizes: Record<string, string> = {
  sm: "h-[var(--control-height-sm)] rounded-[var(--radius-md)] px-3 text-[var(--text-sm)]",
  md: "h-[var(--control-height-md)] rounded-[var(--radius-md)] px-4 text-[var(--text-base)]",
  lg: "h-[var(--control-height-lg)] rounded-[var(--radius-lg)] px-5 text-[var(--text-base)]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
