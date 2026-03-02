import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="rounded-[var(--console-radius-md)] border border-[var(--console-border-light)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-shadow-lg)] transition-colors hover:bg-[var(--console-bg-hover)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--console-border-light)] pb-4">
        <div>
          <h2 className="text-[var(--console-text-xl)] font-semibold text-[var(--console-text-primary)]">{title}</h2>
          {description ? <p className="mt-1 text-[var(--console-text-base)] text-[var(--console-text-secondary)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 text-[var(--console-text-base)] text-[var(--console-text-secondary)]">{actions}</div> : null}
      </header>
      <div className="mt-6 space-y-4 text-[var(--console-text-primary)]">{children}</div>
    </section>
  );
}
