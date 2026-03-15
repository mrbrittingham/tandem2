"use client";

import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "grid min-h-screen grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr]",
        className,
      )}
    >
      {children}
    </div>
  );
}
