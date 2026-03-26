import { crawlWebsite } from "./crawl";
import { buildWebsiteImportResult } from "./extract";
import type { CrawledPage, WebsiteImportResult } from "./types";
import { normalizeWebsiteUrl } from "./utils";

type RunOptions = {
  onPagesCrawled?: (pages: CrawledPage[]) => Promise<void> | void;
};

export async function runWebsiteImport(url: string, options?: RunOptions): Promise<WebsiteImportResult> {
  const normalizedUrl = normalizeWebsiteUrl(url);
  console.log(`[website-import/run] starting scan → url=${normalizedUrl}`);
  const crawl = await crawlWebsite(normalizedUrl, {
    onPageCrawled: options?.onPagesCrawled,
  });
  if (crawl.pages.length === 0) {
    throw new Error("No crawlable pages found. Check URL, permissions, or try a different page.");
  }
  console.log(`[website-import/run] crawl complete → ${crawl.pages.length} pages, ${crawl.signals.colorCandidates.length} colorCandidates`);

  return buildWebsiteImportResult({
    sourceUrl: normalizedUrl,
    pages: crawl.pages,
    signals: crawl.signals,
    crawlReport: crawl.crawlReport,
  });
}
