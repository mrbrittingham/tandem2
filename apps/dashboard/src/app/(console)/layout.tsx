'use client';

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell, SidebarProvider, PageContainer, PageHeader, Toaster } from "@tandem/ui-kit";
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

type ConsolePageHeading = { title: string; description?: string };

const pageHeadingMap: Record<string, ConsolePageHeading> = {
  "/overview": { title: "Overview", description: "Track setup progress and recent customer activity." },
  "/conversations": { title: "Inbox", description: "Review and respond to recent customer conversations." },
  "/intents": { title: "Assistant", description: "Configure suggested actions and how your assistant responds." },
  "/knowledge": { title: "Knowledge", description: "Manage the information your assistant uses to answer customers." },
  "/handoff": { title: "Handoff", description: "Control when conversations route to your team and how customers reach you." },
  "/widget": { title: "Appearance", description: "Customize your website chat widget and grab the install code." },
  "/integrations": { title: "Integrations", description: "Connect tools that keep customer answers up to date." },
  "/settings": { title: "Settings", description: "Manage your business details, assistant behavior, and installation." },
  "/locations": { title: "Locations", description: "Keep location details accurate so your assistant gives the right answers." },
};

function resolvePageHeading(pathname: string) {
  const matchedRoute = Object.keys(pageHeadingMap).find((r) => pathname === r || pathname.startsWith(`${r}/`));
  return matchedRoute ? pageHeadingMap[matchedRoute] : undefined;
}

function ConsoleLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeBusiness = useActiveLocation();
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<WidgetThemeSettings | undefined>(undefined);
  const [isClientMounted, setIsClientMounted] = useState(false);

  const isPreviewOpen = Boolean(activeBusiness) && previewOpen;
  const heading = useMemo(() => resolvePageHeading(pathname), [pathname]);

  useLocationHydration();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClientMounted(true);
  }, []);

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

  return (
    <ConsoleDialogProvider value={providerValue}>
      <PreviewDockProvider value={previewContextValue}>
        <SidebarProvider>
          <AppShell>
            <ConsoleSidebar />

            <div className="flex flex-1 flex-col">
              <ConsoleTopbar
                leading={<LocationSwitcher onAddLocation={() => setCreateLocationOpen(true)} />}
              />

              <PageContainer>
                {heading ? (
                  <PageHeader title={heading.title} description={heading.description} />
                ) : null}
                {children}
              </PageContainer>
            </div>
          </AppShell>
        </SidebarProvider>

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
    </ConsoleDialogProvider>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div />}>
      <ConsoleLayoutClient>{children}</ConsoleLayoutClient>
    </Suspense>
  );
}
