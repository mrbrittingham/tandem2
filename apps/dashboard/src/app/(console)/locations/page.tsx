'use client';

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import type { BusinessProfile } from "@tandem/shared";
import {
  createLocation,
  selectActiveLocation,
  updateBusiness,
  useActiveLocation,
  useLocations,
} from "@/lib/store-hooks";
import {
  composeLocationAddress,
  inferTimezoneFromAddress,
  parseLocationAddress,
  validateLocationFields,
} from "@/lib/location-utils";

type LocationFormState = {
  locationName: string;
  streetAddress: string;
  city: string;
  country: string;
  state: string;
  zip: string;
  phone: string;
  timezone: string;
};

const emptyForm: LocationFormState = {
  locationName: "",
  streetAddress: "",
  city: "",
  country: "United States",
  state: "",
  zip: "",
  phone: "",
  timezone: "UTC",
};

const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Sweden",
  "Norway",
  "Denmark",
  "Ireland",
  "Switzerland",
  "Austria",
  "Portugal",
  "Australia",
  "New Zealand",
  "Other",
];

const REGION_OPTIONS_BY_COUNTRY: Record<string, string[]> = {
  "United States": [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
  ],
  Canada: ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Australia: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"],
  Germany: ["BE", "BW", "BY", "HB", "HE", "HH", "MV", "NI", "NW", "RP", "SH", "SL", "SN", "ST", "TH"],
  France: ["ARA", "BFC", "BRE", "CVL", "GES", "HDF", "IDF", "NOR", "NAQ", "OCC", "PDL", "PAC", "COR"],
  Spain: ["AN", "AR", "AS", "CB", "CL", "CM", "CT", "EX", "GA", "IB", "RI", "MD", "MC", "NC", "PV", "VC"],
  Italy: ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardy", "Marche", "Molise", "Piedmont", "Apulia", "Sardinia", "Sicily", "Tuscany", "Trentino-Alto Adige", "Umbria", "Aosta Valley", "Veneto"],
  Netherlands: ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland"],
  Belgium: ["Brussels", "Flanders", "Wallonia"],
  Sweden: ["Stockholm", "Västra Götaland", "Skåne", "Uppsala", "Östergötland", "Örebro"],
  Norway: ["Oslo", "Rogaland", "Vestland", "Trøndelag", "Viken", "Agder"],
  Denmark: ["Capital", "Zealand", "Southern Denmark", "Central Jutland", "North Jutland"],
  Ireland: ["Leinster", "Munster", "Connacht", "Ulster"],
  Switzerland: ["ZH", "BE", "LU", "UR", "SZ", "OW", "NW", "GL", "ZG", "FR", "SO", "BS", "BL", "SH", "AR", "AI", "SG", "GR", "AG", "TG", "TI", "VD", "VS", "NE", "GE", "JU"],
  Austria: ["Burgenland", "Carinthia", "Lower Austria", "Upper Austria", "Salzburg", "Styria", "Tyrol", "Vorarlberg", "Vienna"],
  Portugal: ["Aveiro", "Braga", "Coimbra", "Faro", "Leiria", "Lisbon", "Porto", "Setúbal", "Madeira", "Azores"],
  "New Zealand": ["Auckland", "Canterbury", "Wellington", "Waikato", "Otago", "Bay of Plenty"],
};

function regionOptions(country: string) {
  const normalized = country.trim().toLowerCase();
  const exact = Object.keys(REGION_OPTIONS_BY_COUNTRY).find((entry) => entry.toLowerCase() === normalized);
  if (exact) {
    return REGION_OPTIONS_BY_COUNTRY[exact] ?? REGION_OPTIONS_BY_COUNTRY["United States"];
  }

  if (normalized === "us" || normalized === "usa" || normalized === "united states") {
    return REGION_OPTIONS_BY_COUNTRY["United States"];
  }

  return REGION_OPTIONS_BY_COUNTRY["United States"];
}

function defaultRegion(country: string) {
  if (country === "United States") {
    return "";
  }
  return regionOptions(country)[0] ?? "";
}

const DEFAULT_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function buildTimezoneOptions(...values: Array<string | undefined>) {
  const merged = new Set(DEFAULT_TIMEZONES);
  values
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .forEach((value) => merged.add(value));

  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
}

function composeAddress(form: LocationFormState) {
  return composeLocationAddress({
    streetAddress: form.streetAddress,
    city: form.city,
    state: form.state,
    zip: form.zip,
    country: form.country,
  });
}

function readPhone(location?: BusinessProfile) {
  if (!location) {
    return "";
  }

  const contactPhone = location.contacts.find((contact) => contact.type === "phone")?.value?.trim();
  const isSeedPhone = (value?: string) => [
    "+1 (415) 555-0198",
    "+1 (212) 555-0142",
    "+1 (303) 555-0158",
  ].includes((value ?? "").trim());

  if (contactPhone) {
    return isSeedPhone(contactPhone) ? "" : contactPhone;
  }

  const handoffPhone = location.handoff.contactMethods.find((method) => method.type === "phone")?.value?.trim();
  if (isSeedPhone(handoffPhone)) {
    return "";
  }

  return handoffPhone ?? "";
}

function upsertPhone(location: BusinessProfile, phoneValue: string) {
  const phone = phoneValue.trim();

  const existingContactPhone = location.contacts.find((contact) => contact.type === "phone");
  if (phone) {
    if (existingContactPhone) {
      existingContactPhone.value = phone;
      existingContactPhone.enabled = true;
    } else {
      location.contacts.unshift({
        id: crypto.randomUUID(),
        type: "phone",
        label: "Front desk",
        value: phone,
        enabled: true,
      });
    }
  } else if (existingContactPhone) {
    existingContactPhone.enabled = false;
  }

  const existingHandoffPhone = location.handoff.contactMethods.find((method) => method.type === "phone");
  if (phone) {
    if (existingHandoffPhone) {
      existingHandoffPhone.value = phone;
      existingHandoffPhone.enabled = true;
    } else {
      location.handoff.contactMethods.unshift({
        id: crypto.randomUUID(),
        type: "phone",
        label: "Phone",
        value: phone,
        enabled: true,
      });
    }
  } else if (existingHandoffPhone) {
    existingHandoffPhone.enabled = false;
  }
}

function buildFormFromLocation(location?: BusinessProfile): LocationFormState {
  const parsed = parseLocationAddress(location?.location ?? "");
  const inferredTimezone = inferTimezoneFromAddress({
    country: parsed.country,
    state: parsed.state,
  });
  const existingTimezone = (location?.timezone ?? "").trim();
  const timezone = inferredTimezone || existingTimezone || "UTC";

  return {
    locationName: location?.locationName ?? "",
    streetAddress: parsed.streetAddress,
    city: parsed.city,
    country: parsed.country || "United States",
    state: parsed.state || defaultRegion(parsed.country || "United States"),
    zip: parsed.zip,
    phone: readPhone(location),
    timezone,
  };
}

function deriveBusinessTitle(location: BusinessProfile) {
  const fromLocationName = (location.locationName ?? "").trim();
  if (fromLocationName) {
    return fromLocationName;
  }

  const fromName = (location.name ?? "").trim();
  if (fromName) {
    return fromName;
  }

  const fromBusinessName = (location.businessName ?? "").trim();
  if (fromBusinessName) {
    return fromBusinessName;
  }

  const fromAddress = (location.location ?? "").split(",")[0]?.trim();
  if (fromAddress) {
    return fromAddress;
  }

  return `Location ${location.id.slice(-4).toUpperCase()}`;
}

function deriveStreetAddress(location: BusinessProfile) {
  const address = (location.location ?? "").trim();
  return address || "Address not set";
}

export default function LocationsPage() {
  const locations = useLocations();
  const activeLocation = useActiveLocation();
  const [panelMode, setPanelMode] = useState<"edit" | "create">("edit");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<LocationFormState>(() => ({
    ...emptyForm,
    phone: readPhone(activeLocation),
    timezone: activeLocation?.timezone || "UTC",
  }));
  const [editForm, setEditForm] = useState<LocationFormState>(() => buildFormFromLocation(activeLocation));

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const primary = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (primary !== 0) {
        return primary;
      }
      const aName = (a.locationName ?? "").trim();
      const bName = (b.locationName ?? "").trim();
      if (aName === bName) {
        return 0;
      }
      return aName < bName ? -1 : 1;
    });
  }, [locations]);

  const selectedLocation = locations.find((entry) => entry.id === activeLocation?.id) ?? locations[0];

  const syncEditForm = (locationId: string) => {
    const location = locations.find((entry) => entry.id === locationId);
    if (!location) {
      return;
    }

    setEditForm({
      ...buildFormFromLocation(location),
    });
  };

  const handleSelectLocation = (locationId: string) => {
    selectActiveLocation(locationId);
    setPanelMode("edit");
    syncEditForm(locationId);
  };

  const saveEdit = async () => {
    const locationId = selectedLocation?.id;
    const locationSlug = (selectedLocation?.locationSlug ?? selectedLocation?.slug ?? "").trim();
    const hasAddressInput = [
      editForm.streetAddress,
      editForm.city,
      editForm.state,
      editForm.zip,
    ].some((value) => value.trim().length > 0);
    const composedAddress = hasAddressInput ? composeAddress(editForm) : "";
    const inferredTimezone = inferTimezoneFromAddress({
      country: editForm.country,
      state: editForm.state,
    });

    if (!locationId || !editForm.locationName.trim() || !editForm.timezone.trim()) {
      return;
    }

    setEditStatus(null);
    setIsSavingEdit(true);

    updateBusiness(locationId, (draft) => {
      draft.locationName = editForm.locationName.trim();
      draft.location = composedAddress;
      draft.timezone = editForm.timezone.trim() || inferredTimezone || "UTC";
      upsertPhone(draft, editForm.phone);
    });

    try {
      const response = await fetch("/api/locations", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          locationId,
          locationSlug: locationSlug || undefined,
          name: editForm.locationName.trim(),
          address: composedAddress || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setEditStatus(payload.error ? `Saved locally only: ${payload.error}` : "Saved locally only.");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        location?: { id?: string; slug?: string; name?: string; address?: string | null };
      };
      const persistedId = (payload.location?.id ?? "").trim();
      const persistedSlug = (payload.location?.slug ?? "").trim();

      if (persistedId && persistedId !== locationId) {
        updateBusiness(locationId, (draft) => {
          draft.id = persistedId;
          if (persistedSlug) {
            draft.locationSlug = persistedSlug;
            draft.slug = persistedSlug;
          }
        });
        selectActiveLocation(persistedId);
      } else if (persistedSlug) {
        updateBusiness(locationId, (draft) => {
          draft.locationSlug = persistedSlug;
          draft.slug = persistedSlug;
        });
      }

      setEditStatus("Location saved.");
    } catch {
      setEditStatus("Saved locally only.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    if (selectedLocation?.id) {
      syncEditForm(selectedLocation.id);
    }
  };

  const handleAddLocation = async () => {
    const locationName = createForm.locationName.trim();
    const address = composeAddress(createForm);
    const timezone = createForm.timezone.trim() || inferTimezoneFromAddress({
      country: createForm.country,
      state: createForm.state,
    }) || "UTC";
    const phone = createForm.phone.trim();

    if (!locationName || !address || !timezone) {
      return;
    }

    setCreateStatus(null);
    setIsCreatingLocation(true);

    const created = createLocation({
      name: locationName,
      address,
      mode: "fresh",
    });

    updateBusiness(created.id, (draft) => {
      draft.locationName = locationName;
      draft.location = address;
      draft.timezone = timezone;
      upsertPhone(draft, phone);
    });

    setPanelMode("edit");
    setEditForm(buildFormFromLocation({
      ...created,
      locationName,
      location: address,
      timezone,
    }));
    setCreateForm({
      ...emptyForm,
      phone,
      timezone,
    });

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: locationName,
          address,
          mode: "fresh",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setCreateStatus(payload.error ? `Created locally only: ${payload.error}` : "Created locally only.");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        location?: { id?: string; slug?: string; name?: string; address?: string | null };
      };
      const persistedId = (payload.location?.id ?? "").trim();
      const persistedSlug = (payload.location?.slug ?? "").trim();

      if (persistedId) {
        updateBusiness(created.id, (draft) => {
          draft.id = persistedId;
          if (persistedSlug) {
            draft.locationSlug = persistedSlug;
            draft.slug = persistedSlug;
          }
        });
        selectActiveLocation(persistedId);
      } else if (persistedSlug) {
        updateBusiness(created.id, (draft) => {
          draft.locationSlug = persistedSlug;
          draft.slug = persistedSlug;
        });
      }

      setCreateStatus("Location created.");
    } catch {
      setCreateStatus("Created locally only.");
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const openCreateMode = () => {
    setPanelMode("create");
    const source = activeLocation ?? selectedLocation;
    setCreateForm({
      ...emptyForm,
      phone: readPhone(source),
      timezone: source?.timezone || "UTC",
    });
  };

  const canCreate = Boolean(
    createForm.locationName.trim()
      && createForm.streetAddress.trim()
      && createForm.city.trim()
      && createForm.state.trim()
      && createForm.zip.trim()
      && createForm.timezone.trim(),
  );

  const canSaveEdit = Boolean(
    editForm.locationName.trim()
      && editForm.timezone.trim(),
  );

  const createTimezoneOptions = useMemo(
    () => buildTimezoneOptions(createForm.timezone, activeLocation?.timezone, selectedLocation?.timezone),
    [activeLocation?.timezone, createForm.timezone, selectedLocation?.timezone],
  );

  const editTimezoneOptions = useMemo(
    () => buildTimezoneOptions(editForm.timezone, selectedLocation?.timezone, activeLocation?.timezone),
    [activeLocation?.timezone, editForm.timezone, selectedLocation?.timezone],
  );

  const createErrors = useMemo(
    () => validateLocationFields({
      streetAddress: createForm.streetAddress,
      city: createForm.city,
      state: createForm.state,
      zip: createForm.zip,
      country: createForm.country,
    }),
    [createForm],
  );

  const editErrors = useMemo(
    () => validateLocationFields({
      streetAddress: editForm.streetAddress,
      city: editForm.city,
      state: editForm.state,
      zip: editForm.zip,
      country: editForm.country,
    }),
    [editForm],
  );

  const hasCreateErrors = Object.keys(createErrors).length > 0;
  const hasEditErrors = Object.keys(editErrors).length > 0;

  if (!locations.length) {
    return (
      <EmptyState
        title="No locations yet"
        description="Add a location to start configuring assistant content and routing."
        actionLabel="Add location"
        onAction={openCreateMode}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
            <button
              type="button"
              onClick={openCreateMode}
              className="rounded-xl bg-[var(--console-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)]"
            >
              Add location
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {sortedLocations.map((location) => {
              const isCurrent = activeLocation?.id === location.id;
              const isSelected = isCurrent;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleSelectLocation(location.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{deriveBusinessTitle(location)}</p>
                      <p className="text-sm text-slate-600">{deriveStreetAddress(location)}</p>
                      <p className="text-xs text-slate-500">{location.timezone || "UTC"}</p>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Current</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {panelMode === "create" ? (
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create location</h2>
                <p className="mt-1 text-sm text-slate-600">Add a location with name, address, and timezone.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Location name</span>
                  <input
                    value={createForm.locationName}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, locationName: event.target.value }))}
                    placeholder="Trademark Ave"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Street address</span>
                  <input
                    value={createForm.streetAddress}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, streetAddress: event.target.value }))}
                    placeholder="640 Trademark Ave"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">City</span>
                  <input
                    value={createForm.city}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="San Francisco"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  {createErrors.city ? <p className="mt-1 text-xs text-rose-600">{createErrors.city}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Country</span>
                  <select
                    value={createForm.country}
                    onChange={(event) => {
                      const country = event.target.value;
                      setCreateForm((prev) => ({
                        ...prev,
                        country,
                        state: defaultRegion(country),
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">State</span>
                  <select
                    value={createForm.state}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, state: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select state</option>
                    {regionOptions(createForm.country).map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  {createErrors.state ? <p className="mt-1 text-xs text-rose-600">{createErrors.state}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">ZIP code</span>
                  <input
                    value={createForm.zip}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, zip: event.target.value }))}
                    placeholder="94107"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  {createErrors.zip ? <p className="mt-1 text-xs text-rose-600">{createErrors.zip}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Phone</span>
                  <input
                    value={createForm.phone}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="(410) 555-0123"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Timezone</span>
                  <select
                    value={createForm.timezone}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, timezone: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {createTimezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddLocation}
                  disabled={!canCreate || hasCreateErrors || isCreatingLocation}
                  className="rounded-xl bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCreatingLocation ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode("edit")}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
              {createStatus ? <p className="text-xs text-slate-600">{createStatus}</p> : null}
            </div>
          ) : selectedLocation ? (
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit location</h2>
                <p className="mt-1 text-sm text-slate-600">Update location details used throughout the console.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Location name</span>
                  <input
                    value={editForm.locationName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, locationName: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Street address</span>
                  <input
                    value={editForm.streetAddress}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, streetAddress: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">City</span>
                  <input
                    value={editForm.city}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, city: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  {editErrors.city ? <p className="mt-1 text-xs text-rose-600">{editErrors.city}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Country</span>
                  <select
                    value={editForm.country}
                    onChange={(event) => {
                      const country = event.target.value;
                      setEditForm((prev) => ({
                        ...prev,
                        country,
                        state: defaultRegion(country),
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">State</span>
                  <select
                    value={editForm.state}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, state: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select state</option>
                    {regionOptions(editForm.country).map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  {editErrors.state ? <p className="mt-1 text-xs text-rose-600">{editErrors.state}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">ZIP code</span>
                  <input
                    value={editForm.zip}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, zip: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  {editErrors.zip ? <p className="mt-1 text-xs text-rose-600">{editErrors.zip}</p> : null}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Phone</span>
                  <input
                    value={editForm.phone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="(410) 555-0123"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Timezone</span>
                  <select
                    value={editForm.timezone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, timezone: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {editTimezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={!canSaveEdit || hasEditErrors || isSavingEdit}
                  className="rounded-xl bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSavingEdit ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
              {editStatus ? <p className="text-xs text-slate-600">{editStatus}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Select a location to edit details.</p>
          )}
        </section>
      </div>
    </div>
  );
}
