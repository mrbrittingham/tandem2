import { crawlWebsite } from "./crawl";
import { buildWebsiteImportResult } from "./extract";
import type { WebsiteImportResult } from "./types";
import { normalizeWebsiteUrl } from "./utils";

export async function runWebsiteImport(url: string): Promise<WebsiteImportResult> {
  const normalizedUrl = normalizeWebsiteUrl(url);
  const crawl = await crawlWebsite(normalizedUrl);
  if (crawl.pages.length === 0) {
    throw new Error("No crawlable pages found. Check URL, permissions, or try a different page.");
  }

  return buildWebsiteImportResult({
    sourceUrl: normalizedUrl,
    pages: crawl.pages,
    signals: crawl.signals,
  });
}
