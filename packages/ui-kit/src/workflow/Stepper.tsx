import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type StepperStep = {
  label: string;
  description?: string;
};

export type StepperProps = {
  steps: StepperStep[];
  /** 0-based index of current step */
  current: number;
  className?: string;
};

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("flex items-center gap-2", className)}>
      {steps.map((step, i) => {
        const isComplete = i < current;
        const isCurrent = i === current;

        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8",
                  isComplete ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]",
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[var(--text-xs)] font-semibold transition-colors",
                  isComplete && "bg-[var(--color-primary)] text-[var(--color-text-inverse)]",
                  isCurrent && "border-2 border-[var(--color-primary)] text-[var(--color-primary)]",
                  !isComplete && !isCurrent && "border border-[var(--color-border)] text-[var(--color-text-muted)]",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div className="hidden sm:block">
                <span
                  className={cn(
                    "text-[var(--text-sm)] font-medium",
                    isCurrent ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
