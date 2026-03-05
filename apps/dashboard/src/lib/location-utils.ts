const US_STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DC: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  IA: "America/Chicago",
  ID: "America/Denver",
  IL: "America/Chicago",
  IN: "America/New_York",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/New_York",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  MT: "America/Denver",
  NC: "America/New_York",
  ND: "America/Chicago",
  NE: "America/Chicago",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NV: "America/Los_Angeles",
  NY: "America/New_York",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VA: "America/New_York",
  VT: "America/New_York",
  WA: "America/Los_Angeles",
  WI: "America/Chicago",
  WV: "America/New_York",
  WY: "America/Denver",
};

export type ParsedLocationAddress = {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;
const STATE_ZIP_REGEX = /^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCountry(value: string) {
  const normalized = clean(value);
  if (!normalized) return "United States";
  if (/^(us|usa|united\s+states)$/i.test(normalized)) return "United States";
  return normalized;
}

function normalizeState(value: string) {
  const state = clean(value).toUpperCase();
  return state;
}

export function parseLocationAddress(value: string): ParsedLocationAddress {
  const raw = clean(value);
  if (!raw) {
    return {
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      country: "United States",
    };
  }

  const parts = raw.split(",").map(clean).filter(Boolean);
  const countryCandidate = parts.length >= 2 ? parts[parts.length - 1] : "United States";
  const country = normalizeCountry(countryCandidate);
  const hasExplicitCountry = parts.length >= 2 && countryCandidate.toLowerCase() !== parts[parts.length - 2]?.toLowerCase()
    && (/united\s+states|usa|us|canada|united\s+kingdom|germany|france|spain|italy|netherlands|australia|new\s+zealand/i.test(countryCandidate));

  const core = hasExplicitCountry ? parts.slice(0, -1) : parts;
  const streetAddress = core[0] ?? "";

  let city = "";
  let state = "";
  let zip = "";

  if (core.length >= 3) {
    city = core[1] ?? "";
    const stateZipRaw = core[2] ?? "";
    const stateZipMatch = STATE_ZIP_REGEX.exec(stateZipRaw);
    if (stateZipMatch) {
      state = normalizeState(stateZipMatch[1] ?? "");
      zip = clean(stateZipMatch[2] ?? "");
    } else {
      city = core[1] ?? "";
      state = normalizeState(core[2] ?? "");
    }
  } else if (core.length === 2) {
    const second = core[1] ?? "";
    const match = /^(.*?)(?:\s+([A-Za-z]{2}))?(?:\s+(\d{5}(?:-\d{4})?))?$/.exec(second);
    if (match) {
      city = clean(match[1] ?? "");
      state = normalizeState(match[2] ?? "");
      zip = clean(match[3] ?? "");
    }
  }

  if (!zip) {
    const zipMatch = raw.match(ZIP_REGEX);
    if (zipMatch) {
      zip = zipMatch[0];
    }
  }

  return {
    streetAddress,
    city,
    state,
    zip,
    country,
  };
}

export function composeLocationAddress(input: ParsedLocationAddress): string {
  const cityStateZip = [clean(input.city), [normalizeState(input.state), clean(input.zip)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return [clean(input.streetAddress), cityStateZip, normalizeCountry(input.country)]
    .filter(Boolean)
    .join(", ")
    .trim();
}

export function inferTimezoneFromAddress(input: Pick<ParsedLocationAddress, "country" | "state">): string | null {
  if (normalizeCountry(input.country) !== "United States") {
    return null;
  }
  const state = normalizeState(input.state);
  return US_STATE_TIMEZONES[state] ?? null;
}

export function validateLocationFields(input: ParsedLocationAddress): Partial<Record<keyof ParsedLocationAddress, string>> {
  const errors: Partial<Record<keyof ParsedLocationAddress, string>> = {};

  if (/\b\d{5}(?:-\d{4})?\b/.test(input.city)) {
    errors.city = "City should not include ZIP code";
  }

  if (normalizeCountry(input.country) === "United States") {
    if (!/^[A-Za-z]{2}$/.test(input.state.trim())) {
      errors.state = "State must be a 2-letter code";
    }

    if (!/^\d{5}$/.test(input.zip.trim())) {
      errors.zip = "ZIP must be 5 digits";
    }
  }

  return errors;
}
