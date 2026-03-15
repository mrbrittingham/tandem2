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
    "group/card rounded-[16px] border border-[var(--color-border)] bg-white p-5 shadow-xs md:p-6 transition-all duration-200 relative overflow-hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const computedHeaderClassName = [
    "mb-4 space-y-0.5 pb-3",
    headerDivider ? "border-b border-[var(--color-border-subtle)]" : "",
    headerClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const computedBodyClassName = ["space-y-4 text-[var(--color-text)] relative z-10", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--color-primary)]/10 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100" />
      <header className={computedHeaderClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
          <div>
            {eyebrow ? (
              <p className={["text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]", eyebrowClassName].filter(Boolean).join(" ")}>{eyebrow}</p>
            ) : null}
            <h2 className={["text-[15px] font-[600] text-[var(--color-text)]", titleClassName].filter(Boolean).join(" ")}>{title}</h2>
            {description ? <p className={["max-w-3xl text-[13px] text-[var(--color-text-secondary)] mt-0.5", descriptionClassName].filter(Boolean).join(" ")}>{description}</p> : null}
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
