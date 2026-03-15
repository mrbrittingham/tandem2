import test from "node:test";
import assert from "node:assert/strict";
import {
  WEBSITE_IMPORT_LIMITS,
  excerptText,
  isSameDomain,
  normalizeCandidateUrl,
  normalizeWebsiteUrl,
} from "./utils";

test("normalizeWebsiteUrl adds protocol and strips hash", () => {
  const value = normalizeWebsiteUrl("example.com/about#top");
  assert.equal(value, "https://example.com/about");
});

test("normalizeCandidateUrl resolves relative links", () => {
  const value = normalizeCandidateUrl("/contact", "https://example.com/about");
  assert.equal(value, "https://example.com/contact");
});

test("isSameDomain checks host equality", () => {
  assert.equal(isSameDomain("https://a.example.com", "https://a.example.com/page"), true);
  assert.equal(isSameDomain("https://example.com", "https://other.com"), false);
});

test("excerptText caps output", () => {
  const value = excerptText("a".repeat(30), 10);
  assert.equal(value.length, 10);
});

test("crawl limits remain bounded", () => {
  assert.ok(WEBSITE_IMPORT_LIMITS.maxPages >= 15);
  assert.ok(WEBSITE_IMPORT_LIMITS.maxPages <= 30);
  assert.equal(WEBSITE_IMPORT_LIMITS.maxChars, 250_000);
});
