"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  Topbar,
  Avatar,
  IconButton,
  Kbd,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@tandem/ui-kit";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Props = {
  leading?: ReactNode;
};

export function ConsoleTopbar({ leading }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Topbar
      leading={leading}
      center={
        <button
          type="button"
          className="flex h-8 w-full max-w-md items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 text-[var(--text-sm)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)]"
          aria-label="Open command palette"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
            <circle cx="6" cy="6" r="4.5" />
            <path d="m12.5 12.5-3-3" />
          </svg>
          <span className="flex-1 text-left">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
      }
      trailing={
        <div className="flex items-center gap-1">
          {/* Notification bell placeholder */}
          <IconButton label="Notifications" variant="ghost">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5.5a4 4 0 0 0-8 0c0 4.5-2 5.5-2 5.5h12s-2-1-2-5.5Z" />
              <path d="M9.15 13a1.5 1.5 0 0 1-2.3 0" />
            </svg>
          </IconButton>

          {/* Account menu */}
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-full"
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
        </div>
      }
    />
  );
}
