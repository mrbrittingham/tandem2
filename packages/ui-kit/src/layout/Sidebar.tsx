"use client";

import { useRef, useCallback, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import { useSidebar } from "./sidebar-context";

export type SidebarProps = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Sidebar({ header, footer, children, className }: SidebarProps) {
  const { collapsed, toggle } = useSidebar();
  const navRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const nav = navRef.current;
      if (!nav) return;
      const items = Array.from(
        nav.querySelectorAll<HTMLElement>("[data-sidebar-item]"),
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next = -1;
      if (e.key === "ArrowDown") next = current < items.length - 1 ? current + 1 : 0;
      if (e.key === "ArrowUp") next = current > 0 ? current - 1 : items.length - 1;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = items.length - 1;
      if (next >= 0) {
        e.preventDefault();
        items[next]?.focus();
      }
    },
    [],
  );

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-[var(--color-sidebar-divider)]",
        "[background:var(--color-sidebar-bg-gradient)]",
        "transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out)]",
        collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
        className,
      )}
    >
      {/* Brand / header area */}
      <div className={cn("px-4 pt-5 pb-2", collapsed && "px-2 items-center")}>
        {header ?? (
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-sm font-bold text-white">
              T
            </span>
            {!collapsed && (
              <span className="text-sm font-semibold text-[var(--color-sidebar-text-active)]">
                Tandem
              </span>
            )}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div className={cn("px-4 py-1", collapsed && "px-2 flex justify-center")}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[var(--text-xs)] font-medium",
            "text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text-active)] hover:bg-[var(--color-sidebar-hover)]",
            "transition-colors",
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform", collapsed && "rotate-180")}
          >
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M6 2v12" />
            <path d="M10 7 8 9l2 2" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        onKeyDown={handleKeyDown}
        className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1"
        aria-label="Main navigation"
      >
        {children}
      </nav>

      {/* Footer */}
      {footer ? (
        <div className={cn("border-t border-[var(--color-sidebar-divider)] px-2 py-3", collapsed && "px-1")}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
