'use client';

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KnowledgePage from "@/app/(console)/knowledge/page";
import HandoffPage from "@/app/(console)/handoff/page";
import AssistantPage from "@/app/(console)/intents/page";
import WidgetPage from "@/app/(console)/widget/page";

type Tab = "knowledge" | "handoff" | "behavior" | "appearance";

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: "knowledge", label: "Knowledge", description: "Menu, hours, events, FAQs, and contact info your chatbot draws from." },
  { key: "handoff", label: "Handoff", description: "When and how to escalate to a real person." },
  { key: "behavior", label: "Behavior", description: "Personality, tone, and what topics to stay focused on." },
  { key: "appearance", label: "Appearance", description: "Colors, logo, and branding for the chat widget." },
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
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-[var(--console-text-primary)] shadow-sm"
                : "text-[var(--console-text-secondary)] hover:text-[var(--console-text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab context line */}
      {activeTabMeta && (
        <p className="mb-5 px-1 text-xs text-[var(--console-text-tertiary)]">{activeTabMeta.description}</p>
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
