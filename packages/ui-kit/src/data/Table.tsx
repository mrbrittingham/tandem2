"use client";

import {
  type ReactNode,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
  type HTMLAttributes,
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { cn } from "../lib/cn";

/* ── Sort context ────────────────────────────────── */
type SortDir = "asc" | "desc" | null;
type SortState = { column: string; direction: SortDir };
type SortCtx = { sort: SortState; onSort: (column: string) => void };

const SortContext = createContext<SortCtx | null>(null);

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  /** Enable client-side sort state tracking */
  sortable?: boolean;
  /** Callback when sort changes */
  onSortChange?: (sort: SortState) => void;
};

/* ── Root ─────────────────────────────────────────── */
export function Table({ sortable, onSortChange, className, children, ...props }: TableProps) {
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });

  const onSort = useCallback(
    (column: string) => {
      setSort((prev) => {
        const next: SortState =
          prev.column === column
            ? { column, direction: prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc" }
            : { column, direction: "asc" };
        onSortChange?.(next);
        return next;
      });
    },
    [onSortChange],
  );

  const table = (
    <div className={cn("overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      <table className="w-full border-collapse text-left text-[var(--text-sm)]" {...props}>
        {children}
      </table>
    </div>
  );

  if (!sortable) return table;
  return <SortContext.Provider value={{ sort, onSort }}>{table}</SortContext.Provider>;
}

/* ── Head / Body / Row ───────────────────────────── */
export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-[var(--color-border)] bg-[var(--color-bg)]", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&>tr:not(:last-child)]:border-b [&>tr:not(:last-child)]:border-[var(--color-border-subtle)]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[var(--color-surface-hover)]",
        "data-[selected=true]:bg-[var(--color-primary-light)]",
        className,
      )}
      {...props}
    />
  );
}

/* ── Header cell ─────────────────────────────────── */
export type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  sortKey?: string;
};

export function TableHeaderCell({ sortKey, className, children, ...props }: TableHeaderCellProps) {
  const ctx = useContext(SortContext);
  const isSortable = !!sortKey && !!ctx;
  const isActive = isSortable && ctx.sort.column === sortKey;

  return (
    <th
      className={cn(
        "px-4 py-3 text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)]",
        isSortable && "cursor-pointer select-none",
        className,
      )}
      onClick={isSortable ? () => ctx.onSort(sortKey) : undefined}
      aria-sort={isActive ? (ctx.sort.direction === "asc" ? "ascending" : ctx.sort.direction === "desc" ? "descending" : "none") : undefined}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isSortable && (
          <span className={cn("text-[10px]", isActive ? "text-[var(--color-primary)]" : "opacity-40")}>
            {isActive && ctx.sort.direction === "asc" ? "▲" : isActive && ctx.sort.direction === "desc" ? "▼" : "⇅"}
          </span>
        )}
      </span>
    </th>
  );
}

/* ── Data cell ───────────────────────────────────── */
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-[var(--color-text)]", className)} {...props} />;
}

/* ── Empty / Loading states ──────────────────────── */
export function TableEmpty({ colSpan, children }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">
        {children ?? "No results found"}
      </td>
    </tr>
  );
}

export function TableLoading({ colSpan, rows = 3 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: colSpan }, (_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
