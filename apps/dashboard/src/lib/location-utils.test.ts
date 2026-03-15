import assert from "node:assert/strict";
import test from "node:test";
import {
  composeLocationAddress,
  inferTimezoneFromAddress,
  parseLocationAddress,
  validateLocationFields,
} from "./location-utils";

test("parseLocationAddress handles US city/state/zip", () => {
  const parsed = parseLocationAddress("17 Jefferson St, Berlin, MD 21811, United States");
  assert.equal(parsed.streetAddress, "17 Jefferson St");
  assert.equal(parsed.city, "Berlin");
  assert.equal(parsed.state, "MD");
  assert.equal(parsed.zip, "21811");
});

test("composeLocationAddress keeps normalized city/state/zip format", () => {
  const value = composeLocationAddress({
    streetAddress: "17 Jefferson St",
    city: "Berlin",
    state: "md",
    zip: "21811",
    country: "US",
  });
  assert.equal(value, "17 Jefferson St, Berlin, MD 21811, United States");
});

test("inferTimezoneFromAddress maps US state to timezone", () => {
  assert.equal(inferTimezoneFromAddress({ country: "United States", state: "MD" }), "America/New_York");
});

test("validateLocationFields catches city/zip/state errors", () => {
  const errors = validateLocationFields({
    streetAddress: "980 Valencia St",
    city: "Berlin 21811",
    state: "Maryland",
    zip: "2181",
    country: "United States",
  });

  assert.equal(errors.city, "City should not include ZIP code");
  assert.equal(errors.state, "State must be a 2-letter code");
  assert.equal(errors.zip, "ZIP must be 5 digits");
});
