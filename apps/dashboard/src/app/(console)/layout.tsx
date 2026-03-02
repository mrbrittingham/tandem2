'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Radio,
  Settings,
  Sliders,
  User,
  type LucideIcon,
} from "lucide-react";
import { ChatWidget } from "@tandem/ui-kit";
import { ConsoleDialogProvider } from "@/components/ConsoleDialogContext";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { PreviewDockProvider } from "@/components/PreviewDockContext";
import { businessToWidgetConfig, useActiveLocation } from "@/lib/store-hooks";

type NavItem = {
  label: string;
  href: string;
  group: "primary" | "secondary";
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/overview", group: "primary", icon: LayoutDashboard },
  { label: "Conversations", href: "/conversations", group: "primary", icon: MessageSquare },
  { label: "Knowledge Base", href: "/knowledge-base", group: "primary", icon: BookOpen },
  { label: "Channels", href: "/channels", group: "primary", icon: Radio },
  { label: "Integrations", href: "/integrations", group: "primary", icon: Plug },
  { label: "Analytics", href: "/analytics", group: "primary", icon: BarChart3 },
  { label: "Assistant Settings", href: "/assistant-settings", group: "secondary", icon: Settings },
  { label: "Advanced", href: "/advanced", group: "secondary", icon: Sliders },
  { label: "Account", href: "/account", group: "secondary", icon: User },
];

function SidebarLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      key={item.href}
      href={item.href}
      className={`group flex h-[var(--console-sidebar-item-height)] items-center gap-2.5 rounded-[var(--console-sidebar-item-radius)] px-2.5 text-[13px] font-medium leading-none transition-all duration-200 ${
        isActive
          ? 'bg-[var(--console-sidebar-active-bg)] [color:var(--console-sidebar-text-active)] shadow-[var(--console-sidebar-active-glow)]'
          : '[color:var(--console-sidebar-text)] hover:bg-[var(--console-sidebar-hover-bg)] hover:[color:var(--console-sidebar-text-active)]'
      }`}
    >
      <Icon
        aria-hidden="true"
        size={18}
        strokeWidth={1.5}
        className={`shrink-0 transition-colors duration-200 ${
          isActive
            ? '[color:var(--console-sidebar-icon-active)]'
            : '[color:var(--console-sidebar-icon)] group-hover:[color:var(--console-sidebar-icon-active)]'
        }`}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeBusiness = useActiveLocation();
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPreviewOpen = Boolean(activeBusiness) && previewOpen;

  const widgetConfig = useMemo(
    () => (activeBusiness ? businessToWidgetConfig(activeBusiness) : undefined),
    [activeBusiness],
  );

  const providerValue = useMemo(
    () => ({
      openCreateLocation: () => setCreateLocationOpen(true),
      openCreateBusiness: () => setCreateLocationOpen(true),
    }),
    [setCreateLocationOpen],
  );

  const previewContextValue = useMemo(
    () => ({
      isOpen: previewOpen,
      open: () => setPreviewOpen(true),
      close: () => setPreviewOpen(false),
    }),
    [previewOpen, setPreviewOpen],
  );

  return (
    <ConsoleDialogProvider value={providerValue}>
      <PreviewDockProvider value={previewContextValue}>
        <div className="min-h-screen bg-[var(--console-bg-page)] text-[var(--console-text-primary)] [font-family:var(--console-font-family)]">
          <div className="grid min-h-screen gap-0 lg:grid-cols-[var(--console-sidebar-width)_1fr]">
            <aside className="flex flex-col border-r border-[var(--console-sidebar-divider)] [background:var(--console-gradient-sidebar)] px-2 py-4">
              <div className="px-1 pb-4">
                <p className="text-[var(--console-text-xs)] font-semibold uppercase tracking-[0.4em] text-[var(--console-sidebar-brand-title)]">Tandem</p>
                <p className="mt-2 text-[var(--console-text-xl)] font-semibold text-[var(--console-sidebar-brand-subtitle)]">Client console</p>
                <p className="mt-1 text-[var(--console-text-sm)] leading-[var(--console-leading-normal)] text-[var(--console-sidebar-brand-caption)]">Guide your concierge setup in minutes.</p>
                <div className="mt-4 border-t border-[var(--console-sidebar-brand-divider)]" />
              </div>
              <nav className="mt-6 flex flex-1 flex-col gap-0.5">
                {navItems.filter((item) => item.group === "primary").map((item) => {
                  const isActive = pathname === item.href;
                  return <SidebarLink key={item.href} item={item} isActive={isActive} />;
                })}
                <div className="my-4 border-t border-[var(--console-sidebar-divider)]" />
                {navItems.filter((item) => item.group === "secondary").map((item) => {
                  const isActive = pathname === item.href;
                  return <SidebarLink key={item.href} item={item} isActive={isActive} />;
                })}
              </nav>
            </aside>
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-10 flex min-h-[var(--console-header-height)] flex-wrap items-center justify-between gap-3 border-b border-[var(--console-border)] bg-[var(--console-bg-card)] px-[var(--console-page-pad-x)] py-2.5 text-[var(--console-text-sm)] text-[var(--console-text-secondary)] shadow-[var(--console-shadow-sm)]">
                <div className="flex min-w-[220px] flex-1">
                  <label className="relative w-full max-w-[280px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--console-text-tertiary)]">⌕</span>
                    <input
                      type="search"
                      placeholder="Search..."
                      className="h-10 w-full rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--console-bg-page)] pl-9 pr-3 text-[var(--console-text-sm)] text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[var(--console-text-sm)] text-[var(--console-text-secondary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--console-success)]" />
                    Assistant Live
                  </span>
                  <LocationSwitcher onAddLocation={() => setCreateLocationOpen(true)} />
                  <div className="hidden text-right lg:block">
                    <p className="text-[var(--console-text-sm)] font-medium text-[var(--console-text-primary)]">Team Member</p>
                    <p className="text-[var(--console-text-xs)] text-[var(--console-text-tertiary)]">Admin</p>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--console-primary)] text-[var(--console-text-xs)] font-semibold text-[var(--console-text-inverse)]">
                    TM
                  </span>
                </div>
              </header>
              <main className="flex-1 bg-[var(--console-bg-page)] px-[var(--console-page-pad-x)] py-[var(--console-page-pad-y)]">
                <div className="w-full max-w-[var(--console-content-max-width)]">{children}</div>
              </main>
            </div>
          </div>
        </div>

        {!isPreviewOpen ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={!widgetConfig}
            className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--console-primary)] text-[var(--console-text-inverse)] shadow-[var(--console-shadow-xl)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--console-bg-disabled)]"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M5 5h14v10H8l-3 3Z" />
            </svg>
            <span className="sr-only">Open preview</span>
          </button>
        ) : null}

        {isPreviewOpen && widgetConfig ? (
          <ChatWidget
            config={widgetConfig}
            initiallyOpen
            showLauncher={false}
            theme={{ panelMaxHeight: 'var(--console-preview-widget-max-height)' }}
          />
        ) : null}
        <CreateLocationDialog open={createLocationOpen} onClose={() => setCreateLocationOpen(false)} />
      </PreviewDockProvider>
    </ConsoleDialogProvider>
  );
}
