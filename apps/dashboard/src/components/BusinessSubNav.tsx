"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

function NavIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>;
}

const BUSINESS_NAV = [
  {
    label: "General info",
    href: "/settings",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="5" r="2.5" />
          <path d="M2 13c0-2.76 2.24-5 5-5s5 2.24 5 5" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Menu",
    href: "/menus",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 4h3M2.5 7h3M2.5 10h3" />
          <rect x="7" y="2.5" width="4.5" height="9" rx="1" />
          <path d="M8.5 5h2M8.5 7.5h1.5" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12V3a1.5 1.5 0 0 1 1.5-1.5h7.5v10H4a1.5 1.5 0 0 0-1.5 1.5Z" />
          <path d="M2.5 12A1.5 1.5 0 0 0 4 13.5h7.5v-1.5H4a1.5 1.5 0 0 1-1.5 0Z" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Assistant",
    href: "/intents",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="8" height="6" rx="1.5" />
          <path d="M7 4.5V3" />
          <circle cx="5.5" cy="7.5" r="0.5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
          <path d="M5.5 9.5h3" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Appearance",
    href: "/widget",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="5.5" />
          <circle cx="5" cy="5.5" r="0.75" fill="currentColor" />
          <circle cx="9" cy="5.5" r="0.75" fill="currentColor" />
          <circle cx="4.5" cy="8" r="0.75" fill="currentColor" />
          <path d="M9.5 8c0 1.2-.6 2.5-2.5 2.5s-2-1.3-2-1.3" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Handoff",
    href: "/handoff",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 3 5.5 8.5" />
          <path d="M11 3H7M11 3v4" />
          <path d="M3 11l5.5-5.5" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 2.5v2.5" />
          <path d="M8.5 2.5v2.5" />
          <path d="M4 5h6v2.5a3 3 0 0 1-6 0V5Z" />
          <path d="M7 10v2" />
        </svg>
      </NavIcon>
    ),
  },
  {
    label: "Locations",
    href: "/locations",
    icon: (
      <NavIcon>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 13S2.5 9.3 2.5 6a4.5 4.5 0 0 1 9 0c0 3.3-4.5 7-4.5 7Z" />
          <circle cx="7" cy="6" r="1.5" />
        </svg>
      </NavIcon>
    ),
  },
] as const;

export const BUSINESS_NAV_PATHS = BUSINESS_NAV.map((item) => item.href);

export function BusinessSubNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[200px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Your business
        </h2>
      </div>
      <nav className="flex flex-col px-2 py-3 gap-0.5">
        {BUSINESS_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className={isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
