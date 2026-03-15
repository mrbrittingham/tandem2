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
    <div className={cn("mt-6 first:mt-2", className)}>
      {label && !collapsed ? (
        <p className="px-3 mb-1 text-[11px] font-[500] text-[rgba(255,255,255,0.38)]">
          {label.toLowerCase()}
        </p>
      ) : label && collapsed ? (
        <div className="mx-auto my-2 h-px w-5 bg-[var(--color-sidebar-divider)]" />
      ) : null}
      <div className="flex flex-col gap-[1px]">{children}</div>
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
        "group relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] min-h-[36px] text-[13px] font-medium",
        "outline-none transition-all duration-[100ms]",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1",
        active
          ? "bg-[rgba(37,99,235,0.22)] text-white"
          : "text-[var(--color-sidebar-text)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white",
        collapsed && "justify-center px-0",
        collapsed && active && "shadow-none bg-[rgba(37,99,235,0.22)]",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-[16px] w-[16px] shrink-0 items-center justify-center",
            active
              ? "text-white"
              : "text-[var(--color-sidebar-icon)] opacity-70 group-hover:text-white",
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
