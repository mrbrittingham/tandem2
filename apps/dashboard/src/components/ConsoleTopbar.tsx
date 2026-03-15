"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  Avatar,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useSidebar,
} from "@tandem/ui-kit";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePreviewDock } from "@/components/PreviewDockContext";
import { useRouter } from "next/navigation";

type Props = {
  leading?: ReactNode;
};

const BUSINESS_PATHS = ["/knowledge", "/menus", "/intents", "/widget", "/handoff", "/integrations", "/settings", "/locations"];

function matchesPath(pathname: string, href: string, extra?: string[]) {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (extra) return extra.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return false;
}

function NavTab({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const base =
    "flex items-center gap-1.5 px-3 h-[52px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap";
  const activeClass = "border-white text-white";
  const inactiveClass = "border-transparent text-white/55 hover:text-white/85";

  if (!href && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${active ? activeClass : inactiveClass}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      className={`${base} ${active ? activeClass : inactiveClass}`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function ConsoleTopbar({ leading }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleMobile } = useSidebar();
  const { open: openPreview } = usePreviewDock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const isBusinessActive = BUSINESS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  return (
    <header
      className="sticky top-0 z-10 flex shrink-0 items-center border-b border-white/8"
      style={{ background: "var(--color-sidebar-bg-gradient)", minHeight: "52px" }}
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        className="flex lg:hidden ml-3 h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Open navigation"
        onClick={toggleMobile}
      >
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4.5h13M2 8.5h13M2 12.5h13" />
        </svg>
      </button>

      {/* Nav tabs */}
      <nav className="flex flex-1 items-center overflow-x-auto scrollbar-none px-2 lg:px-3">
        <NavTab
          href="/overview"
          label="Overview"
          active={matchesPath(pathname, "/overview")}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="5" height="5" rx="1" />
              <rect x="8" y="1" width="5" height="5" rx="1" />
              <rect x="1" y="8" width="5" height="5" rx="1" />
              <rect x="8" y="8" width="5" height="5" rx="1" />
            </svg>
          }
        />
        <NavTab
          href="/settings"
          label="Settings"
          active={isBusinessActive}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1.5 1.5 5v7.5h3.5V9h4v3.5H12.5V5Z" />
            </svg>
          }
        />
        <NavTab
          href="/conversations"
          label="Chats"
          active={matchesPath(pathname, "/conversations")}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 2h11v8H8.5L6 12.5 5.5 10H1.5Z" />
            </svg>
          }
        />
        <NavTab
          label="Preview chat"
          active={false}
          onClick={openPreview}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5.5" />
              <path d="M7 4.5v4M5 6.5 7 4.5l2 2" />
            </svg>
          }
        />
      </nav>

      {/* Right: location switcher + user */}
      <div className="flex shrink-0 items-center gap-2 pr-3 pl-1">
        {leading && <div className="hidden sm:block">{leading}</div>}

        {mounted ? (
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-full ring-2 ring-white/15"
              >
                <Avatar initials="TM" size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        ) : (
          <Avatar initials="TM" size="sm" />
        )}
      </div>
    </header>
  );
}
