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
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
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
  eyebrowClassName,
  titleClassName,
  descriptionClassName,
  children,
}: SectionCardProps) {
  const sectionClassName = [
    "rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] md:p-6",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const computedHeaderClassName = [
    "mb-5 space-y-1 pb-4",
    headerDivider ? "border-b border-[var(--color-border-subtle)]" : "",
    headerClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const computedBodyClassName = ["space-y-4 text-[var(--color-text)]", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <header className={computedHeaderClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow ? (
              <p className={["text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]", eyebrowClassName].filter(Boolean).join(" ")}>{eyebrow}</p>
            ) : null}
            <h2 className={["text-[var(--text-lg)] font-semibold tracking-tight text-[var(--color-text)]", titleClassName].filter(Boolean).join(" ")}>{title}</h2>
            {description ? <p className={["max-w-3xl text-[var(--text-sm)] text-[var(--color-text-secondary)]", descriptionClassName].filter(Boolean).join(" ")}>{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-3 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      <div className={computedBodyClassName}>{children}</div>
    </section>
  );
}
