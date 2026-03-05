import assert from "node:assert/strict";
import test from "node:test";
import { buildWebsiteImportResult } from "./extract";
import { crawlWebsite } from "./crawl";

test("crawl + extraction regression: multi-page business content is discovered", async (t) => {
  const originalFetch = globalThis.fetch;

  const pages = new Map<string, string>([
    [
      "https://windmill.example/",
      `<!doctype html>
      <html>
        <head><title>Windmill Creek Vineyard</title></head>
        <body>
          <main>
            <p>Small-lot winery crafting estate wines in a restored barn tasting room.</p>
          </main>
          <footer>
            <p>Windmill Creek Vineyard</p>
            <p>125 Harvest Lane, Helena, CA 94574</p>
            <p>Tasting Room Hours: Thu-Sun 11am - 6pm</p>
          </footer>
        </body>
      </html>`,
    ],
    [
      "https://windmill.example/contact",
      `<!doctype html>
      <html>
        <head><title>Contact</title></head>
        <body>
          <h1>Contact Us</h1>
          <p>Phone: (707) 555-0123</p>
          <p>Email: hello@windmill.example</p>
          <a href="mailto:hello@windmill.example?subject=Reservation">Email us</a>
        </body>
      </html>`,
    ],
    [
      "https://windmill.example/faq",
      `<!doctype html>
      <html>
        <head><title>FAQ</title></head>
        <body>
          <h1>Frequently Asked Questions</h1>
          <p>Do you accept walk-ins? Yes, we welcome walk-ins when space is available, but weekend reservations are strongly recommended.</p>
        </body>
      </html>`,
    ],
    [
      "https://windmill.example/policies",
      `<!doctype html>
      <html>
        <head><title>Reservation Policy</title></head>
        <body>
          <p>Reservation and cancellation policy for all tasting experiences.</p>
        </body>
      </html>`,
    ],
  ]);

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const key = `${url.origin}${url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "")}`;
    const normalized = key === "https://windmill.example" ? "https://windmill.example/" : key;
    const body = pages.get(normalized);
    if (!body) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const crawl = await crawlWebsite("https://windmill.example");
  assert.ok(crawl.pages.some((page) => page.url.endsWith("/contact")));
  assert.ok(crawl.pages.some((page) => page.url.endsWith("/faq")));
  assert.ok(crawl.signals.emails.some((entry) => entry.value === "hello@windmill.example"));
  assert.ok(crawl.signals.addresses.some((entry) => entry.value.includes("Harvest Lane")));

  const result = await buildWebsiteImportResult({
    sourceUrl: "https://windmill.example",
    pages: crawl.pages,
    signals: crawl.signals,
  });

  assert.ok(result.draft.faqs.length > 0);
  assert.ok(result.draft.policies.length > 0);
  assert.equal(result.draft.businessProfile.email.value, "hello@windmill.example");
});
