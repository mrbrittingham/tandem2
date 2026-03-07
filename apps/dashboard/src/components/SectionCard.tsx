import type { ReactNode } from "react";

export interface SectionCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  headerDivider?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  eyebrow,
  title,
  description,
  actions,
  headerDivider = true,
  className,
  headerClassName,
  bodyClassName,
  children,
}: SectionCardProps) {
  const sectionClassName = [
    "rounded-3xl border border-[var(--console-card-border)] bg-[var(--console-bg-card)] p-6 shadow-[var(--console-card-shadow)] md:p-7",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const computedHeaderClassName = [
    "mb-6 space-y-2 pb-5",
    headerDivider ? "border-b border-[var(--console-border-light)]" : "",
    headerClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const computedBodyClassName = ["space-y-4 text-[var(--console-text-primary)]", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <header className={computedHeaderClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-text-tertiary)]">{eyebrow}</p>
            ) : null}
            <h2 className="text-2xl font-semibold text-[var(--console-text-primary)]">{title}</h2>
            {description ? <p className="max-w-3xl text-sm text-[var(--console-text-secondary)]">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-3 text-sm text-[var(--console-text-secondary)]">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      <div className={computedBodyClassName}>{children}</div>
    </section>
  );
}
