import assert from "node:assert/strict";
import test from "node:test";
import { buildWebsiteImportResult } from "./extract";
import type { ImportSignals } from "./types";

const emptySignals: ImportSignals = {
  emails: [],
  phones: [],
  addresses: [],
  hours: [],
  socialLinks: [],
  logoCandidates: [],
  faviconCandidates: [],
  colorCandidates: [],
  fontCandidates: [],
};

test("fallback FAQ extraction filters contact-form/nav noise", async () => {
  const result = await buildWebsiteImportResult({
    sourceUrl: "https://windmill.example",
    pages: [
      {
        url: "https://windmill.example/faq",
        title: "Frequently Asked Questions",
        textExcerpt:
          "Skip to content Contact Us What can we help with? Name Email Message Submit Do you accept walk-ins? Yes, we welcome walk-ins when space is available and weekend reservations are strongly recommended.",
      },
    ],
    signals: emptySignals,
  });

  assert.ok(result.draft.faqs.length >= 1);
  assert.ok(result.draft.faqs.some((entry) => /walk-ins/i.test(entry.question)));
  assert.ok(result.draft.faqs.every((entry) => !/skip to content|what can we help with|contact us/i.test(entry.question)));
});
