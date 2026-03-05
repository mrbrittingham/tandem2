import test from "node:test";
import assert from "node:assert/strict";
import { isWebsiteImportDraft } from "./schema";

const validDraft = {
  sourceUrl: "https://example.com",
  businessProfile: {
    name: { value: "Example", sourceUrl: "https://example.com" },
    shortDescription: { value: "Desc", sourceUrl: "https://example.com" },
    phone: { value: "+1 555 0100", sourceUrl: "https://example.com/contact" },
    email: { value: "hi@example.com", sourceUrl: "https://example.com/contact" },
    address: { value: "123 Main St", sourceUrl: "https://example.com/contact" },
    hours: { value: "Mon-Fri 9-5", sourceUrl: "https://example.com/hours" },
    socialLinks: [],
  },
  faqs: [],
  policies: [],
  brand: {
    primaryColor: { value: "#3170FC", sourceUrl: "https://example.com" },
    accentColor: { value: "#9E4770", sourceUrl: "https://example.com" },
    backgroundColor: { value: "#FFFFFF", sourceUrl: "https://example.com" },
    textColor: { value: "#0F172A", sourceUrl: "https://example.com" },
    fontFamily: { value: "Inter, sans-serif", sourceUrl: "https://example.com" },
    logoUrl: { value: "https://example.com/logo.svg", sourceUrl: "https://example.com" },
  },
  evidence: {
    pages: [{ url: "https://example.com", title: "Home" }],
  },
};

test("isWebsiteImportDraft validates expected shape", () => {
  assert.equal(isWebsiteImportDraft(validDraft), true);
  assert.equal(isWebsiteImportDraft({ ...validDraft, sourceUrl: 123 }), false);
});
