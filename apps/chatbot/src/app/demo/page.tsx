'use client';

import { useMemo, useState } from "react";
import {
  ChatWidget,
  type MessageDescriptor,
  type ThemeTokens,
} from "@tandem/ui-kit";

const clientTheme: Partial<ThemeTokens> = {
  brandName: "Northwind",
  logoUrl:
    "https://images.unsplash.com/photo-1476357471311-43c0db9fb2b4?auto=format&w=200&q=80",
  primaryColor: "#0f172a",
  primaryTextColor: "#fefce8",
  accentColor: "#f97316",
  accentTextColor: "#0f172a",
  surfaceColor: "#0b1220",
  surfaceMutedColor: "#11192c",
  surfaceContrastColor: "#f8fafc",
  borderColor: "#1e293b",
  mutedColor: "#94a3b8",
  panelShadow: "0 35px 70px rgba(15, 23, 42, 0.45)",
  panelRadius: "24px",
  bubbleRadius: "18px",
  userBubbleBg: "#f97316",
  userBubbleText: "#0f172a",
  assistantBubbleBg: "#11192c",
  assistantBubbleText: "#f8fafc",
  ctaBg: "#fef3c7",
  ctaText: "#7c2d12",
};

const ctaMessages: MessageDescriptor[] = [
  {
    role: "assistant",
    text: "I can send over our onboarding kit if you're ready.",
    cta: {
      label: "View onboarding kit",
      href: "https://example.com/onboarding",
    },
  },
  {
    role: "assistant",
    text: "Need anything else for your evaluation?",
  },
];

const sections = [
  {
    title: "Default theme",
    description: "Matches Tandem's neutral concierge styling.",
    value: "default",
  },
  {
    title: "Client brand",
    description: "Simulates a darker, orange-accented deployment.",
    value: "client",
  },
] as const;

const samples = [
  {
    title: "Standard greeting",
    description: "Shows the baseline assistant welcome.",
    value: "standard",
  },
  {
    title: "CTA spotlight",
    description: "Adds an assistant card with a deep-link button.",
    value: "cta",
  },
] as const;

export default function DemoPage() {
  const [themeChoice, setThemeChoice] = useState<(typeof sections)[number]["value"]>(
    "default",
  );
  const [sampleChoice, setSampleChoice] = useState<(typeof samples)[number]["value"]>(
    "cta",
  );

  const theme = themeChoice === "client" ? clientTheme : undefined;
  const initialMessages = useMemo(
    () => (sampleChoice === "cta" ? ctaMessages : undefined),
    [sampleChoice],
  );

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tandem UI kit
          </p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold">Theme showcase</h1>
            <p className="text-lg text-zinc-600">
              Toggle between built-in and client-supplied tokens, then preview how CTA buttons render inside assistant messages.
            </p>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-800">Theme presets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const active = themeChoice === section.value;
              return (
                <button
                  key={section.value}
                  type="button"
                  onClick={() => setThemeChoice(section.value)}
                  className={`rounded-2xl border p-4 text-left transition hover:border-zinc-400 ${
                    active
                      ? "border-black bg-white shadow-lg"
                      : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-800">
                    {section.title}
                  </p>
                  <p className="text-sm text-zinc-500">{section.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-800">Message sample</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {samples.map((sample) => {
              const active = sampleChoice === sample.value;
              return (
                <button
                  key={sample.value}
                  type="button"
                  onClick={() => setSampleChoice(sample.value)}
                  className={`rounded-2xl border p-4 text-left transition hover:border-zinc-400 ${
                    active
                      ? "border-black bg-white shadow-lg"
                      : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-800">
                    {sample.title}
                  </p>
                  <p className="text-sm text-zinc-500">{sample.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Live preview</p>
          <p className="text-base text-zinc-600">
            Use the controls above, then interact with the floating launcher below.
          </p>
        </div>
      </div>

      <ChatWidget
        key={`${themeChoice}-${sampleChoice}`}
        theme={theme}
        initialMessages={initialMessages}
      />
    </div>
  );
}
