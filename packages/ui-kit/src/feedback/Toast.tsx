"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export type ToasterProps = {
  /** Position on screen */
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
};

export function Toaster({ position = "bottom-right" }: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-lg)] text-[var(--text-sm)] text-[var(--color-text)]",
          title: "font-medium",
          description: "text-[var(--color-text-secondary)] text-[var(--text-xs)]",
          actionButton:
            "ml-auto shrink-0 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1 text-[var(--text-xs)] font-medium text-[var(--color-text-inverse)]",
          cancelButton:
            "ml-auto shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]",
          error: "border-[var(--color-danger)] text-[var(--color-danger)]",
          success: "border-[var(--color-success)] text-[var(--color-success)]",
          warning: "border-[var(--color-warning)]",
          info: "border-[var(--color-info)]",
        },
      }}
    />
  );
}
