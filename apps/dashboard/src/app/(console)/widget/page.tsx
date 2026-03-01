'use client';

import { useMemo, useState } from "react";
import type { BusinessProfile, WidgetThemeSettings } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ColorPicker } from "@/components/ColorPicker";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";

const colorFields: Array<{ key: keyof WidgetThemeSettings; label: string }> = [
  { key: "primaryColor", label: "Primary color" },
  { key: "accentColor", label: "Accent color" },
  { key: "surfaceColor", label: "Surface color" },
  { key: "textPrimaryColor", label: "Text color" },
  { key: "textSecondaryColor", label: "Muted text" },
];

export default function WidgetPage() {
  const business = useActiveBusiness();
  const { openCreateBusiness } = useConsoleDialogs();
  if (!business) {
    return (
      <EmptyState
        title="No business selected"
        description="Create a business to customize the widget look and grab the install snippet."
        actionLabel="Create business"
        onAction={openCreateBusiness}
      />
    );
  }

  return <WidgetEditor key={business.id} business={business} />;
}

function WidgetEditor({ business }: { business: BusinessProfile }) {
  const [theme, setTheme] = useState<WidgetThemeSettings>(() => ({ ...business.theme }));
  const [logoUrl, setLogoUrl] = useState(() => business.theme.logoUrl ?? "");
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    return `<script async src="https://cdn.tandem.dev/widget.js" data-business="${business.slug}"></script>`;
  }, [business.slug]);

  const handleThemeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateBusiness(business.id, (draft) => {
      draft.theme = { ...theme, logoUrl: logoUrl || undefined };
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Widget look & feel"
        description="Keep the Tandem brand consistent across every client site."
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleThemeSubmit}>
          {colorFields.map((field) => (
            <ColorPicker
              key={field.key}
              label={field.label}
              value={theme[field.key] as string}
              onChange={(value) =>
                setTheme((prev) => (prev ? { ...prev, [field.key]: value } : prev))
              }
            />
          ))}
          <TextInput
            label="Font family"
            value={theme.fontFamily}
            onChange={(value) => setTheme((prev) => (prev ? { ...prev, fontFamily: value } : prev))}
            placeholder="'Inter', sans-serif"
          />
          <TextInput
            label="Logo URL"
            value={logoUrl}
            onChange={setLogoUrl}
            placeholder="https://cdn.tandem.dev/logo.svg"
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Save theme
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Add chat to your website"
        description="Paste this script inside the <head> on every page where the assistant should appear."
      >
        <pre className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-900 p-4 text-sm text-slate-100">
          <code>{snippet}</code>
        </pre>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {copied ? "Copied" : "Copy snippet"}
          </button>
          <a
            href="https://docs.tandem.dev/widget-install"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            View docs
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
