'use client';

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell, SidebarProvider, Toaster, useSidebar } from "@tandem/ui-kit";
import type { WidgetThemeSettings } from "@tandem/shared";
import { ConsoleDialogProvider } from "@/components/ConsoleDialogContext";
import { ConsoleSidebar } from "@/components/ConsoleSidebar";
import { ConsoleTopbar } from "@/components/ConsoleTopbar";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { PreviewDockProvider } from "@/components/PreviewDockContext";
import { PreviewPanel } from "@/components/PreviewPanel";
import { useActiveLocation } from "@/lib/store-hooks";
import { useLocationHydration } from "@/lib/use-location-hydration";
import { AISidebarProvider } from "@/contexts/AISidebarContext";

function ConsoleLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeBusiness = useActiveLocation();
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<WidgetThemeSettings | undefined>(undefined);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const { setMobileOpen } = useSidebar();

  const isPreviewOpen = Boolean(activeBusiness) && previewOpen;

  useLocationHydration();

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const providerValue = useMemo(
    () => ({
      openCreateLocation: () => setCreateLocationOpen(true),
      openCreateBusiness: () => setCreateLocationOpen(true),
    }),
    [],
  );

  const previewContextValue = useMemo(
    () => ({
      isOpen: previewOpen,
      open: () => setPreviewOpen(true),
      close: () => setPreviewOpen(false),
      draftTheme,
      setDraftTheme,
    }),
    [draftTheme, previewOpen],
  );

  return (
    <ConsoleDialogProvider value={providerValue}>
      <AISidebarProvider>
      <PreviewDockProvider value={previewContextValue}>
        <AppShell>
          {/* Left: AI chat panel */}
          <ConsoleSidebar />

          {/* Right: topnav + content */}
          <div className="flex min-h-screen flex-col overflow-hidden">
            <ConsoleTopbar
              leading={<LocationSwitcher onAddLocation={() => setCreateLocationOpen(true)} />}
            />

            {/* Content row: page */}
              <div className="flex flex-1 overflow-hidden">
              <main className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
                <div className="max-w-[1160px] px-6 py-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </AppShell>

        <PreviewPanel
          isOpen={isPreviewOpen}
          onClose={() => setPreviewOpen((p) => !p)}
          activeBusiness={activeBusiness}
          draftTheme={draftTheme}
          isClientMounted={isClientMounted}
        />

        <CreateLocationDialog open={createLocationOpen} onClose={() => setCreateLocationOpen(false)} />
        <Toaster />
      </PreviewDockProvider>
      </AISidebarProvider>
    </ConsoleDialogProvider>
  );
}

function ConsoleLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ConsoleLayoutInner>{children}</ConsoleLayoutInner>
    </SidebarProvider>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div />}>
      <ConsoleLayoutClient>{children}</ConsoleLayoutClient>
    </Suspense>
  );
}
