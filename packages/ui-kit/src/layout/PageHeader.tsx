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
    <section className={cn("flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 pt-1 sm:pt-0">{actions}</div> : null}
    </section>
  );
}
