"use client";

import type { CrawledPage, ImportRunStatus, WebsitePageType } from "@/lib/website-import/types";

type Props = {
  url: string;
  pages: CrawledPage[];
  status: ImportRunStatus | null;
};

type PageTypeInfo = {
  label: string;
  bgClass: string;
  textClass: string;
};

const PAGE_TYPE_INFO: Record<WebsitePageType, PageTypeInfo> = {
  menu: { label: "Menu", bgClass: "bg-emerald-100", textClass: "text-emerald-800" },
  hours: { label: "Hours", bgClass: "bg-blue-100", textClass: "text-blue-800" },
  contact: { label: "Contact", bgClass: "bg-violet-100", textClass: "text-violet-800" },
  reservations: { label: "Reservations", bgClass: "bg-orange-100", textClass: "text-orange-800" },
  events: { label: "Events", bgClass: "bg-pink-100", textClass: "text-pink-800" },
  faq: { label: "FAQs", bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
  policies: { label: "Policies", bgClass: "bg-slate-100", textClass: "text-slate-700" },
  about: { label: "About", bgClass: "bg-teal-100", textClass: "text-teal-800" },
  memberships: { label: "Memberships", bgClass: "bg-indigo-100", textClass: "text-indigo-800" },
  "private-events": { label: "Private Events", bgClass: "bg-pink-100", textClass: "text-pink-800" },
  catering: { label: "Catering", bgClass: "bg-lime-100", textClass: "text-lime-800" },
  home: { label: "Home", bgClass: "bg-gray-100", textClass: "text-gray-700" },
  general: { label: "Page", bgClass: "bg-gray-100", textClass: "text-gray-600" },
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Right-panel component for Stage 2 (scan in progress).
 * Shows domain, animated activity indicator, page count, and
 * color-coded page type badges as pages are discovered.
 */
export function ScanProgressPanel({ url, pages, status }: Props) {
  const domain = extractDomain(url);
  const isRunning = status === null || status === "queued" || status === "running";

  // Collect unique page types seen so far
  const seenTypes = new Set<WebsitePageType>();
  for (const page of pages) {
    if (page.pageType && page.pageType !== "general" && page.pageType !== "home") {
      seenTypes.add(page.pageType);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Domain header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          Scanning
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--color-text)] break-all">
          {domain}
        </p>
      </div>

      {/* Animated activity indicator */}
      {isRunning ? (
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)] opacity-80"
                style={{
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)]">
            Crawling pages…
          </span>
        </div>
      ) : null}

      {/* Page count */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-[var(--color-text)]">
          {pages.length}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {pages.length === 1 ? "page visited" : "pages visited"}
        </span>
      </div>

      {/* Page type badges */}
      {seenTypes.size > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
            Content types discovered
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(seenTypes).map((pageType) => {
              const info = PAGE_TYPE_INFO[pageType] ?? PAGE_TYPE_INFO.general;
              return (
                <span
                  key={pageType}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${info.bgClass} ${info.textClass}`}
                >
                  {info.label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Page list (recent, up to 8) */}
      {pages.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
            Pages crawled
          </p>
          <ul className="space-y-1.5">
            {pages.slice(-8).map((page, index) => (
              <li
                key={`${page.url}-${index}`}
                className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"
              >
                <span className="text-emerald-500 flex-shrink-0">✓</span>
                <span className="truncate">{page.title || extractDomain(page.url)}</span>
                {page.pageType && page.pageType !== "general" ? (
                  <span
                    className={`ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PAGE_TYPE_INFO[page.pageType]?.bgClass ?? "bg-gray-100"} ${PAGE_TYPE_INFO[page.pageType]?.textClass ?? "text-gray-600"}`}
                  >
                    {PAGE_TYPE_INFO[page.pageType]?.label ?? page.pageType}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          Fetching pages…
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
