'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChatWidget } from "@tandem/ui-kit";
import { ConsoleDialogProvider } from "@/components/ConsoleDialogContext";
import { CreateBusinessWizard } from "@/components/CreateBusinessWizard";
import { PreviewDockProvider } from "@/components/PreviewDockContext";
import { businessToWidgetConfig, useActiveBusiness } from "@/lib/store-hooks";

const navItems = [
  { label: "Home", href: "/overview" },
  { label: "Conversations", href: "/conversations" },
  { label: "Assistant", href: "/intents" },
  { label: "FAQs & Policies", href: "/knowledge" },
  { label: "Talk to a person", href: "/handoff" },
  { label: "Widget", href: "/widget" },
  { label: "Integrations", href: "/integrations" },
  { label: "LLM status", href: "/llm" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/branding" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeBusiness = useActiveBusiness();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPreviewOpen = Boolean(activeBusiness) && previewOpen;

  const widgetConfig = useMemo(
    () => (activeBusiness ? businessToWidgetConfig(activeBusiness) : undefined),
    [activeBusiness],
  );

  const providerValue = useMemo(
    () => ({
      openCreateBusiness: () => setWizardOpen(true),
    }),
    [setWizardOpen],
  );

  const previewContextValue = useMemo(
    () => ({
      isOpen: previewOpen,
      open: () => setPreviewOpen(true),
      close: () => setPreviewOpen(false),
    }),
    [previewOpen, setPreviewOpen],
  );

  const assistantSummary = activeBusiness
    ? `${activeBusiness.industry} • ${activeBusiness.location || "Location coming soon"}`
    : "Launch an assistant to unlock insights.";

  return (
    <ConsoleDialogProvider value={providerValue}>
      <PreviewDockProvider value={previewContextValue}>
        <div className="min-h-screen bg-[var(--bg)] text-slate-900">
          <div className="grid min-h-screen gap-0 lg:grid-cols-[260px_1fr]">
            <aside className="flex flex-col border-r border-slate-200 bg-white/95 px-6 py-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Tandem</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">Client console</p>
                <p className="text-sm text-slate-500">Guide your concierge setup in minutes.</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-5 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Add business
              </button>
              <nav className="mt-8 flex flex-1 flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'border border-blue-100 bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-slate-200 bg-white/90 px-8 py-5 text-sm text-slate-600 backdrop-blur supports-[backdrop-filter]:bg-white/75 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Active business</p>
                  <p className="text-lg font-semibold text-slate-900">{activeBusiness?.name ?? 'No business yet'}</p>
                  <p className="text-sm text-slate-500">{assistantSummary}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!widgetConfig}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardOpen(true)}
                    className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    New business
                  </button>
                </div>
              </header>
              <main className="flex-1 bg-[var(--bg)] px-6 py-10 md:px-8">{children}</main>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!widgetConfig}
          className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-500/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
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
          <div className="flex h-full flex-col gap-4 overflow-y-auto bg-slate-50 px-4 py-6">
            {widgetConfig ? (
              <div className="mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10">
                <ChatWidget config={widgetConfig} initiallyOpen />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Select or create a business to load a live preview of the assistant experience.
              </p>
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

        <CreateBusinessWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </PreviewDockProvider>
    </ConsoleDialogProvider>
  );
}
