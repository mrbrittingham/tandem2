import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type AppShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Root layout grid. Expects a Sidebar and a main content area as children.
 * The sidebar width is controlled by CSS variables and the collapse state.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "grid min-h-screen grid-cols-1 lg:grid-cols-[var(--sidebar-current-width,var(--sidebar-width))_1fr]",
        "transition-[grid-template-columns] duration-[var(--duration-normal)] ease-[var(--ease-out)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
