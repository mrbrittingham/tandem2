import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFaqCandidate, scoreFaqCandidate } from "./faq-heuristics";

test("normalizeFaqCandidate rejects navigation/form boilerplate", () => {
  const candidate = normalizeFaqCandidate(
    {
      question: "What can we help with?",
      answer: "Name Email Message Submit",
      sourceUrl: "https://example.com/contact",
    },
    { faqPageHint: false, minScore: 4 },
  );

  assert.equal(candidate, null);
});

test("normalizeFaqCandidate accepts real FAQ content", () => {
  const candidate = normalizeFaqCandidate(
    {
      question: "Do you accept walk-ins?",
      answer: "Yes. We welcome walk-ins when space is available, and weekend reservations are strongly recommended.",
      sourceUrl: "https://example.com/faq",
    },
    { faqPageHint: true, minScore: 4 },
  );

  assert.ok(candidate);
  assert.equal(candidate?.question, "Do you accept walk-ins?");
  assert.equal(candidate?.sourceUrl, "https://example.com/faq");
});

test("scoreFaqCandidate heavily penalizes known noisy phrases", () => {
  const noisyScore = scoreFaqCandidate(
    {
      question: "Skip to content?",
      answer: "Contact us and accept all cookies to continue.",
      sourceUrl: "https://example.com",
    },
    false,
  );

  const cleanScore = scoreFaqCandidate(
    {
      question: "Where should I park?",
      answer: "Guest parking is available in the lot behind the building, with overflow spots on Oak Street.",
      sourceUrl: "https://example.com/faq",
    },
    true,
  );

  assert.ok(cleanScore > noisyScore);
});

test("normalizeFaqCandidate rejects URL fragment and social-share pollution", () => {
  const candidate = normalizeFaqCandidate(
    {
      question: "/reserve?utm_source=facebook&fbclid=abc123",
      answer: "Share on Facebook · See more comments · Copy link",
      sourceUrl: "https://example.com/blog",
    },
    { faqPageHint: false, minScore: 4 },
  );

  assert.equal(candidate, null);
});

test("normalizeFaqCandidate rejects contact form label clusters", () => {
  const candidate = normalizeFaqCandidate(
    {
      question: "Can I contact support?",
      answer: "Name Email Phone Subject Message Submit",
      sourceUrl: "https://example.com/contact",
    },
    { faqPageHint: false, minScore: 4 },
  );

  assert.equal(candidate, null);
});
