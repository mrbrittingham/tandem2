"use client";

import { type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useSidebar } from "./sidebar-context";

export type SidebarProps = {
  children: ReactNode;
  className?: string;
};

export function Sidebar({ children, className }: SidebarProps) {
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Desktop: fixed chat panel */}
      <aside
        className={cn(
          "hidden lg:flex flex-col overflow-hidden w-[var(--sidebar-width)]",
          "[background:var(--color-sidebar-bg-gradient)]",
          className,
        )}
      >
        {children}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[264px] flex flex-col overflow-hidden [background:var(--color-sidebar-bg-gradient)]"
          >
            {children}
          </aside>
        </div>
      )}
    </>
  );
}
