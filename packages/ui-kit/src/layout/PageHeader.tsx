import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Action buttons rendered on the right */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <section className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-[var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-[var(--text-sm)] text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </section>
  );
}
