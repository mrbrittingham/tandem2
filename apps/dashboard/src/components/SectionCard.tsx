import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 text-sm text-slate-500">{actions}</div> : null}
      </header>
      <div className="mt-5 space-y-4 text-slate-900">{children}</div>
    </section>
  );
}
