import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type TopbarProps = {
  /** Left slot — e.g. location switcher, breadcrumbs */
  leading?: ReactNode;
  /** Center slot — e.g. search trigger */
  center?: ReactNode;
  /** Right slot — e.g. notifications, avatar */
  trailing?: ReactNode;
  className?: string;
};

export function Topbar({ leading, center, trailing, className }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-[var(--header-height)] items-center gap-4 border-b border-[var(--color-border-subtle)]",
        "bg-[var(--color-surface)] px-5",
        className,
      )}
    >
      {leading ? <div className="flex min-w-0 shrink-0 items-center">{leading}</div> : null}
      {center ? <div className="flex flex-1 items-center justify-center">{center}</div> : <div className="flex-1" />}
      {trailing ? <div className="flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
    </header>
  );
}
