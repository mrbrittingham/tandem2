'use client';

import { Suspense } from "react";
import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KnowledgePage from "@/app/(console)/knowledge/page";
import HandoffPage from "@/app/(console)/handoff/page";
import AssistantPage from "@/app/(console)/intents/page";
import WidgetPage from "@/app/(console)/widget/page";

type Tab = "knowledge" | "handoff" | "behavior" | "appearance";

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  knowledge: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 1.5C5 1.5 2.5 3 2.5 5.5c0 1.5.8 2.8 2 3.5v3l3-1.5 3 1.5V9c1.2-.7 2-2 2-3.5 0-2.5-2.5-4-5-4z" />
    </svg>
  ),
  handoff: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 7.5l-2.5 2.5-2.5-2.5M7.5 10V5" />
      <circle cx="7.5" cy="7.5" r="6" />
    </svg>
  ),
  behavior: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="4.5" r="2.5" />
      <path d="M3.5 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </svg>
  ),
  appearance: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M3.2 3.2l1.4 1.4M10.4 10.4l1.4 1.4M3.2 11.8l1.4-1.4M10.4 4.6l1.4-1.4" />
    </svg>
  ),
};

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: "knowledge", label: "Knowledge", description: "Menu, hours, FAQs & more." },
  { key: "handoff", label: "Handoff", description: "Escalate to a real person." },
  { key: "behavior", label: "Behavior", description: "Personality & tone." },
  { key: "appearance", label: "Appearance", description: "Colors & branding." },
];

function ChatbotTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: Tab =
    rawTab === "handoff" || rawTab === "behavior" || rawTab === "appearance"
      ? rawTab
      : "knowledge";

  const handleTabClick = (key: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`/chatbot?${params.toString()}`);
  };

  const activeTabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="space-y-0">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Chatbot</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">
          Configure knowledge, handoff rules, behavior, and appearance — all in one place.
        </p>
      </header>

      {/* Tab bar */}
      <div
        className="mb-2 flex gap-1 rounded-xl border border-[var(--console-border)] bg-[var(--console-bg-hover)] p-1"
        role="tablist"
        aria-label="Chatbot configuration tabs"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[var(--console-text-primary)] shadow-sm"
                  : "text-[var(--console-text-secondary)] hover:text-[var(--console-text-primary)]"
              }`}
            >
              <span className={`${isActive ? "text-[var(--color-primary)]" : ""}`}>
                {TAB_ICONS[tab.key]}
              </span>
              <span>{tab.label}</span>
              {isActive && (
                <span className="text-[10px] font-normal text-[var(--console-text-tertiary)] hidden sm:block">{tab.description}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab description */}
      {activeTabMeta && (
        <p className="mb-5 px-1 text-xs text-[var(--console-text-tertiary)] sm:hidden">{activeTabMeta.description}</p>
      )}

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "knowledge" && <KnowledgePage hideHeader />}
        {activeTab === "handoff" && <HandoffPage />}
        {activeTab === "behavior" && <AssistantPage hideHeader />}
        {activeTab === "appearance" && <WidgetPage />}
      </div>
    </div>
  );
}

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-sm text-[var(--console-text-secondary)]">Loading…</div>}>
      <ChatbotTabs />
    </Suspense>
  );
}
