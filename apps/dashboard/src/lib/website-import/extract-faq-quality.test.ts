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

test("fallback FAQ extraction rejects URL question and social-share answer", async () => {
  const result = await buildWebsiteImportResult({
    sourceUrl: "https://windmill.example",
    pages: [
      {
        url: "https://windmill.example/faq",
        title: "Frequently Asked Questions",
        textExcerpt:
          "/reserve?utm_source=facebook&fbclid=12345? Share on Facebook See more comments Copy link Do you allow picnics? Yes, guests may enjoy food from our partner vendors in the lawn area during open hours.",
      },
    ],
    signals: emptySignals,
  });

  assert.ok(result.draft.faqs.some((entry) => /allow picnics/i.test(entry.question)));
  assert.ok(result.draft.faqs.every((entry) => !/utm_|share on facebook|copy link|see more/i.test(`${entry.question} ${entry.answer}`.toLowerCase())));
});
