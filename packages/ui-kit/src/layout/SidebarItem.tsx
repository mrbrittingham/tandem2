"use client";

import { type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useSidebar } from "./sidebar-context";

/* ── SidebarGroup ────────────────────────────────── */

export type SidebarGroupProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function SidebarGroup({ label, children, className }: SidebarGroupProps) {
  const { collapsed } = useSidebar();
  return (
    <div className={cn("mt-4 first:mt-0", className)}>
      {label && !collapsed ? (
        <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-sidebar-text-muted)]">
          {label}
        </p>
      ) : label && collapsed ? (
        <div className="mx-auto my-2 h-px w-5 bg-[var(--color-sidebar-divider)]" />
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/* ── SidebarItem ─────────────────────────────────── */

export type SidebarItemProps = {
  href: string;
  icon?: ReactNode;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  className?: string;
  /** Link component — pass Next.js `Link` here */
  as?: React.ElementType;
};

export function SidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
  className,
  as: Comp = "a",
}: SidebarItemProps) {
  const { collapsed } = useSidebar();

  const content = (
    <Comp
      href={href}
      data-sidebar-item=""
      tabIndex={0}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] text-[var(--text-sm)] font-medium",
        "outline-none transition-colors duration-[var(--duration-fast)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1",
        active
          ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text-active)]"
          : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center",
            active
              ? "text-[var(--color-sidebar-icon-active)]"
              : "text-[var(--color-sidebar-icon)] group-hover:text-[var(--color-sidebar-icon-active)]",
          )}
        >
          {icon}
        </span>
      ) : null}
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="ml-auto">{badge}</span>
      ) : null}
    </Comp>
  );

  if (collapsed) {
    return (
      <div className="relative">
        {content}
        {/* Tooltip on hover when collapsed */}
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2",
            "whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--color-text)] px-2.5 py-1 text-[var(--text-xs)] font-medium text-[var(--color-text-inverse)]",
            "opacity-0 transition-opacity group-hover:opacity-100",
            "shadow-[var(--shadow-md)]",
          )}
        >
          {label}
        </div>
      </div>
    );
  }

  return content;
}
