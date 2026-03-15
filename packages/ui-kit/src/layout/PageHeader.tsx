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
    <section className={cn("flex flex-col gap-1.5 pb-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[1.125rem] font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </section>
  );
}
