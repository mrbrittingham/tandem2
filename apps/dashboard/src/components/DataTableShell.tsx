import type { ReactNode } from "react";

type DataTableShellProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableShell({ children, className }: DataTableShellProps) {
  const resolvedClassName = [
    "overflow-x-auto rounded-xl border border-slate-200 bg-white",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={resolvedClassName}>{children}</div>;
}
