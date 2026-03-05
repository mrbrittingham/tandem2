'use client';

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChatWidget, resolveWidgetRuntimeConfig } from "@tandem/ui-kit";
import type { WidgetThemeSettings } from "@tandem/shared";
import { ConsoleDialogProvider } from "@/components/ConsoleDialogContext";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { PreviewDockProvider } from "@/components/PreviewDockContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveChatScope } from "@/lib/chat-scope";
import { businessToWidgetConfig, useActiveLocation } from "@/lib/store-hooks";
import { widgetThemeToChatTheme } from "@/lib/widget-theme";

const navItems = [
  { label: "Overview", href: "/overview" },
  { label: "Inbox", href: "/conversations" },
  { label: "Assistant", href: "/intents" },
  { label: "Knowledge", href: "/knowledge" },
  { label: "Handoff", href: "/handoff" },
  { label: "Widget", href: "/widget" },
  { label: "Integrations", href: "/integrations" },
  { label: "Locations", href: "/locations" },
  { label: "Settings", href: "/branding" },
];

type ConsolePageHeading = {
  title: string;
  description?: string;
};

const pageHeadingMap: Record<string, ConsolePageHeading> = {
  "/overview": {
    title: "Overview",
    description: "Track readiness and recent activity.",
  },
  "/conversations": {
    title: "Inbox",
    description: "Review and respond to recent guest chats.",
  },
  "/intents": {
    title: "Assistant",
    description: "Manage suggested actions and assistant behavior.",
  },
  "/knowledge": {
    title: "Knowledge",
    description: "Maintain FAQs and policies your assistant can reference.",
  },
  "/handoff": {
    title: "Handoff",
    description: "Configure live support and contact methods.",
  },
  "/widget": {
    title: "Widget",
    description: "Install and customize the website chat widget.",
  },
  "/integrations": {
    title: "Integrations",
    description: "Connect systems that keep answers up to date.",
  },
  "/branding": {
    title: "Settings",
    description: "Business profile and defaults.",
  },
  "/locations": {
    title: "Locations",
    description: "Manage location names, addresses, and timezones.",
  },
};

function resolvePageHeading(pathname: string) {
  const matchedRoute = Object.keys(pageHeadingMap).find((route) => pathname === route || pathname.startsWith(`${route}/`));
  return matchedRoute ? pageHeadingMap[matchedRoute] : undefined;
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeBusiness = useActiveLocation();
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<WidgetThemeSettings | undefined>(undefined);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [showPreviewCoachmark, setShowPreviewCoachmark] = useState(false);
  const isPreviewOpen = Boolean(activeBusiness) && previewOpen;
  const currentPageHeading = useMemo(() => resolvePageHeading(pathname), [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    if (pathname !== "/conversations") {
      setHeaderSearch("");
      return;
    }
    setHeaderSearch(searchParams.get("query") ?? "");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || pathname !== "/overview") {
      setShowPreviewCoachmark(false);
      return;
    }

    const dismissed = window.localStorage.getItem("tandem:preview-coachmark-dismissed") === "1";
    setShowPreviewCoachmark(!dismissed);
  }, [pathname]);

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
      draftTheme,
      setDraftTheme,
    }),
    [draftTheme, previewOpen, setPreviewOpen],
  );

  const widgetTheme = useMemo(() => {
    const themeSource = draftTheme ?? activeBusiness?.theme;
    return themeSource ? widgetThemeToChatTheme(themeSource) : undefined;
  }, [activeBusiness?.theme, draftTheme]);

  const previewRuntimeConfig = useMemo(
    () => {
      const scope = resolveChatScope(activeBusiness);
      return resolveWidgetRuntimeConfig({
        businessId: scope.businessId,
        locationSlug: scope.locationSlug,
      });
    },
    [activeBusiness],
  );

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const handleHeaderSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const trimmed = headerSearch.trim();
    if (trimmed) {
      next.set("query", trimmed);
    }
    router.push(`/conversations${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const dismissPreviewCoachmark = () => {
    setShowPreviewCoachmark(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tandem:preview-coachmark-dismissed", "1");
    }
  };

  return (
    <ConsoleDialogProvider value={providerValue}>
      <PreviewDockProvider value={previewContextValue}>
        <div className="min-h-screen bg-[var(--bg)] text-slate-900">
          <div className="grid min-h-screen gap-0 lg:grid-cols-[260px_1fr]">
            <aside className="flex flex-col border-r border-[var(--console-sidebar-divider)] [background:var(--console-gradient-sidebar)] px-6 py-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] [color:var(--console-sidebar-brand-title)]">Tandem</p>
                <p className="mt-2 text-xl font-semibold [color:var(--console-sidebar-brand-subtitle)]">Client console</p>
                <p className="text-sm [color:var(--console-sidebar-brand-caption)]">Guide your concierge setup in minutes.</p>
              </div>
              <nav className="mt-8 flex flex-1 flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[var(--console-sidebar-active-bg)] [color:var(--console-sidebar-text-active)] shadow-[var(--console-sidebar-active-glow)]'
                          : '[color:var(--console-sidebar-text)] hover:bg-[var(--console-sidebar-hover-bg)] hover:[color:var(--console-sidebar-text-active)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-8 py-5 text-sm text-slate-600 backdrop-blur supports-[backdrop-filter]:bg-white/75">
                <div className="grid gap-4 md:grid-cols-[minmax(280px,360px)_1fr] md:items-center md:pr-14">
                  <div>
                    <LocationSwitcher onAddLocation={() => setCreateLocationOpen(true)} />
                  </div>
                  <div>
                    <form onSubmit={handleHeaderSearchSubmit} className="mx-auto w-full max-w-xl">
                      <label className="relative block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                        <input
                          type="search"
                          value={headerSearch}
                          onChange={(event) => setHeaderSearch(event.target.value)}
                          placeholder="Search conversations (name, email, phone, keywords)..."
                          aria-label="Search conversations"
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--console-primary)] focus:outline-none"
                        />
                      </label>
                    </form>
                  </div>
                </div>
                <div className="absolute right-8 top-5">
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={accountMenuOpen}
                      onClick={() => setAccountMenuOpen((prev) => !prev)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--console-primary)] text-xs font-semibold text-white"
                    >
                      TM
                    </button>
                    {accountMenuOpen ? (
                      <div className="absolute right-0 top-full z-20 mt-2 min-w-[160px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        <Link
                          href="/account"
                          onClick={() => setAccountMenuOpen(false)}
                          className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Account
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            void handleSignOut();
                          }}
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Sign out
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </header>
              <main className="flex-1 bg-[var(--bg)] px-6 py-10 md:px-8">
                {currentPageHeading ? (
                  <section className="mb-8">
                    <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">{currentPageHeading.title}</h1>
                    {currentPageHeading.description ? (
                      <p className="mt-2 text-sm text-[var(--console-text-secondary)]">{currentPageHeading.description}</p>
                    ) : null}
                  </section>
                ) : null}
                {children}
              </main>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!widgetConfig}
          className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--console-primary)] text-white shadow-2xl shadow-slate-900/30 transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
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

        {isClientMounted && pathname === "/overview" && showPreviewCoachmark ? (
          <div className="fixed bottom-20 right-24 z-40">
            <div className="flex items-end gap-2">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10">
                Preview chatbot
              </div>
              <svg aria-hidden="true" className="h-8 w-10 text-slate-500" viewBox="0 0 40 32" fill="none">
                <path d="M2 4c13 0 23 4 30 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M28 12l6 4-7 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <button
                type="button"
                onClick={dismissPreviewCoachmark}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-lg shadow-slate-900/10 hover:text-slate-700"
                aria-label="Dismiss preview hint"
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
            isPreviewOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Preview</p>
              <p className="text-sm text-slate-600">Chatbot experience</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300"
            >
              <span className="sr-only">Close preview</span>
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4l8 8m0-8l-8 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex h-full flex-col gap-4 overflow-hidden bg-slate-50 px-4 py-6">
            {widgetConfig && isClientMounted ? (
              <div className="mx-auto h-[var(--console-preview-widget-max-height)] w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10">
                <ChatWidget
                  config={widgetConfig}
                  theme={widgetTheme}
                  businessId={previewRuntimeConfig.businessId}
                  locationSlug={previewRuntimeConfig.locationSlug}
                  apiBaseUrl={previewRuntimeConfig.apiBaseUrl}
                  hydrateHistory={false}
                  initiallyOpen={isPreviewOpen}
                  showLauncher={false}
                  onClose={() => setPreviewOpen(false)}
                />
              </div>
            ) : widgetConfig ? (
              <p className="text-sm text-slate-500">Loading preview…</p>
            ) : (
              <p className="text-sm text-slate-500">Select or create a location to load a live preview of the assistant experience.</p>
            )}
          </div>
        </div>
        {isPreviewOpen ? (
          <button
            type="button"
            aria-hidden="true"
            onClick={() => setPreviewOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-sm"
          />
        ) : null}
        <CreateLocationDialog open={createLocationOpen} onClose={() => setCreateLocationOpen(false)} />
      </PreviewDockProvider>
    </ConsoleDialogProvider>
  );
}
