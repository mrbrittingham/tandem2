"use client";

import { useMemo, useState } from "react";
import { ChatWidget } from "@tandem/ui-kit";
import type { BusinessProfile } from "@tandem/shared";
import { businessToWidgetConfig } from "@tandem/shared";
import { resolveChatScope } from "@/lib/chat-scope";
import { widgetThemeToChatTheme } from "@/lib/widget-theme";

type Props = {
  location: BusinessProfile;
};

function InstallSnippet({ location }: { location: BusinessProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const scope = resolveChatScope(location);

  const snippet = `<script
  src="https://cdn.tandem.ai/widget.js"
  data-business-id="${scope.businessId ?? ""}"
  data-location-slug="${scope.locationSlug ?? ""}"
  defer
></script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        <span>Install snippet</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              HTML snippet
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`text-xs font-medium transition-colors ${
                copied
                  ? "text-emerald-600"
                  : "text-[var(--color-primary)] hover:underline"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto bg-slate-50 px-3 py-2.5 text-[10px] leading-relaxed text-slate-700">
            {snippet}
          </pre>
        </div>
      )}
    </div>
  );
}

export function WidgetPreviewColumn({ location }: Props) {
  const config = useMemo(() => businessToWidgetConfig(location), [location]);
  const theme = useMemo(
    () => (location.theme ? widgetThemeToChatTheme(location.theme) : undefined),
    [location.theme],
  );

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        This is what guests see on your website
      </p>

      {/* Widget preview — constrained width to approximate real embed size */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-slate-50 p-3">
        <div className="relative mx-auto" style={{ width: "100%", maxWidth: 360 }}>
          <ChatWidget
            config={config}
            theme={theme}
            initiallyOpen
            showLauncher={false}
            hydrateHistory={false}
          />
        </div>
      </div>

      <InstallSnippet location={location} />
    </div>
  );
}
