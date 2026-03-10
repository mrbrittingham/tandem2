/**
 * Test script to verify crawler + FAQ extraction pipeline.
 * Usage: npx tsx scripts/test-crawl.ts https://www.windmillcreekvineyard.com/
 */

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npx tsx scripts/test-crawl.ts <URL>");
    process.exit(1);
  }

  const { crawlWebsite } = await import("../apps/dashboard/src/lib/website-import/crawl");
  const { buildWebsiteImportResult } = await import("../apps/dashboard/src/lib/website-import/extract");

  console.log(`\nStarting crawl: ${url}\n`);
  const crawlResult = await crawlWebsite(url);

  console.log(`\n===== CRAWL SUMMARY =====`);
  console.log(`Total pages: ${crawlResult.pages.length}`);
  console.log(`\n===== PAGE LIST =====`);
  for (const page of crawlResult.pages) {
    const path = new URL(page.url).pathname;
    console.log(`  ${path.padEnd(50)} ${page.title.slice(0, 60)}`);
  }

  console.log(`\n===== RUNNING EXTRACTION =====`);
  const result = await buildWebsiteImportResult({
    sourceUrl: url,
    pages: crawlResult.pages,
    signals: crawlResult.signals,
  });

  console.log(`\n===== PAGE CLASSIFICATION =====`);
  for (const page of result.draft.pageClassification) {
    const path = new URL(page.url).pathname;
    console.log(`  ${page.pageType.padEnd(20)} ${path}`);
  }

  console.log(`\n===== FAQ RESULTS (${result.draft.faqs.length} total) =====`);
  for (const faq of result.draft.faqs) {
    const source = faq.sourceUrl ? new URL(faq.sourceUrl).pathname : "n/a";
    const conf = faq.confidence != null ? `${Math.round(faq.confidence * 100)}%` : "n/a";
    console.log(`\n  Q: ${faq.question}`);
    console.log(`  A: ${faq.answer}`);
    console.log(`  Source: ${source}  |  Confidence: ${conf}  |  Include: ${faq.include}`);
  }

  console.log(`\n===== EVENTS (${result.draft.restaurantKnowledge.events.length}) =====`);
  for (const event of result.draft.restaurantKnowledge.events.slice(0, 5)) {
    console.log(`  ${event.title} — ${event.date ?? "no date"}`);
  }

  console.log(`\n===== MENU SECTIONS (${result.draft.restaurantKnowledge.menuSections.length}) =====`);
  for (const section of result.draft.restaurantKnowledge.menuSections) {
    console.log(`  ${section.title} (${section.items.length} items)`);
  }

  console.log(`\n===== BUSINESS PROFILE =====`);
  const bp = result.draft.businessProfile;
  console.log(`  Name: ${bp.name.value}`);
  console.log(`  Phone: ${bp.phone.value} (from ${bp.phone.sourceUrl})`);
  console.log(`  Email: ${bp.email.value} (from ${bp.email.sourceUrl})`);
  console.log(`  Address: ${bp.address.value} (from ${bp.address.sourceUrl})`);
  console.log(`  Hours: ${bp.hours.value} (from ${bp.hours.sourceUrl})`);

  console.log(`\n===== RAW SIGNALS =====`);
  console.log(`  Addresses (${crawlResult.signals.addresses.length}):`);
  for (const a of crawlResult.signals.addresses.slice(0, 10)) {
    console.log(`    "${a.value}" from ${new URL(a.sourceUrl).pathname}`);
  }
  console.log(`  Phones (${crawlResult.signals.phones.length}):`);
  for (const p of crawlResult.signals.phones.slice(0, 5)) {
    console.log(`    "${p.value}" from ${new URL(p.sourceUrl).pathname}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
