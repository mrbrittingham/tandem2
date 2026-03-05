import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="rounded-[var(--console-card-radius)] border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-[var(--console-card-pad)] shadow-[var(--console-card-shadow)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--console-border-light)] pb-3">
        <div>
          <h2 className="text-[var(--console-text-lg)] font-semibold text-[var(--console-text-primary)]">{title}</h2>
          {description ? <p className="mt-1 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">{actions}</div> : null}
      </header>
      <div className="mt-3.5 space-y-3 text-[var(--console-text-primary)]">{children}</div>
    </section>
  );
}
