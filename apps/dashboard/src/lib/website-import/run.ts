import { crawlWebsite } from "./crawl";
import { buildWebsiteImportResult } from "./extract";
import type { CrawledPage, WebsiteImportResult } from "./types";
import { normalizeWebsiteUrl } from "./utils";

type RunOptions = {
  onPagesCrawled?: (pages: CrawledPage[]) => Promise<void> | void;
};

export async function runWebsiteImport(url: string, options?: RunOptions): Promise<WebsiteImportResult> {
  const normalizedUrl = normalizeWebsiteUrl(url);
  const crawl = await crawlWebsite(normalizedUrl, {
    onPageCrawled: options?.onPagesCrawled,
  });
  if (crawl.pages.length === 0) {
    throw new Error("No crawlable pages found. Check URL, permissions, or try a different page.");
  }

  return buildWebsiteImportResult({
    sourceUrl: normalizedUrl,
    pages: crawl.pages,
    signals: crawl.signals,
  });
}
