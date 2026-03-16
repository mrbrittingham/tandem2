"use client";

import { useEffect, useState } from "react";
import type { CrawledPage, ImportRunStatus, WebsiteImportDraft } from "@/lib/website-import/types";

type PollingResult = {
  status: ImportRunStatus | null;
  pages: CrawledPage[];
  draft: WebsiteImportDraft | null;
  errorCode: string | null;
  errorMessage: string | null;
  isPolling: boolean;
};

type LatestRunResponse = {
  run?: {
    id: string;
    status: ImportRunStatus;
    error: string | null;
    errorCode?: string | null;
    pages: CrawledPage[];
    result: WebsiteImportDraft | null;
  } | null;
  error?: string;
};

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set<ImportRunStatus>(["succeeded", "failed"]);

/**
 * Polls GET /api/website-import/latest?runId=X every 2 seconds.
 * Stops automatically when the run reaches a terminal status.
 *
 * @param runId - The import run ID to poll. Pass null to disable polling.
 */
export function useImportPolling(runId: string | null): PollingResult {
  const [status, setStatus] = useState<ImportRunStatus | null>(null);
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [draft, setDraft] = useState<WebsiteImportDraft | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!runId) {
      setStatus(null);
      setPages([]);
      setDraft(null);
      setErrorCode(null);
      setErrorMessage(null);
      setIsPolling(false);
      return;
    }

    // Reset state when runId changes
    setStatus(null);
    setPages([]);
    setDraft(null);
    setErrorCode(null);
    setErrorMessage(null);
    setIsPolling(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    let stopped = false;

    const tick = async () => {
      if (stopped) return;

      try {
        const params = new URLSearchParams({ runId });
        const response = await fetch(`/api/website-import/latest?${params.toString()}`);

        if (!response.ok) {
          if (!stopped) {
            setTimeout(() => { void tick(); }, POLL_INTERVAL_MS);
          }
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as LatestRunResponse;
        const run = payload.run;

        if (!run) {
          if (!stopped) {
            setTimeout(() => { void tick(); }, POLL_INTERVAL_MS);
          }
          return;
        }

        if (!stopped) {
          setStatus(run.status);
          if (run.pages && run.pages.length > 0) {
            setPages(run.pages);
          }
          if (run.result) {
            setDraft(run.result);
          }
          if (run.status === "failed") {
            setErrorCode(run.errorCode ?? null);
            setErrorMessage(run.error ?? null);
          }
        }

        if (TERMINAL_STATUSES.has(run.status)) {
          if (!stopped) {
            setIsPolling(false);
          }
          return;
        }
      } catch {
        // Network error — retry after interval
      }

      if (!stopped) {
        setTimeout(() => { void tick(); }, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      stopped = true;
      setIsPolling(false);
    };
  }, [runId]);

  return { status, pages, draft, errorCode, errorMessage, isPolling };
}
