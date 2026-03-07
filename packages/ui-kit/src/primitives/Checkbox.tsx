"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "../lib/cn";

export type CheckboxProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-[var(--radius-xs)] border border-[var(--color-border-strong)] " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        "data-[state=checked]:bg-[var(--color-primary)] data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:text-[var(--color-text-inverse)] " +
        "transition-colors",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 5.5 4 7.5 8 3" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = "Checkbox";
