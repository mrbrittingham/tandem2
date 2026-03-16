import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebsiteImportDraft, WebsiteImportRunRecord } from "./types";

type JsonObject = Record<string, unknown>;

type ImportRunRow = {
  id: string;
  location_id: string;
  url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  error_code: string | null;
  source: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  applied_at: string | null;
  pages_json: unknown;
  signals_json: unknown;
  result_json: unknown;
};

type LocationRow = {
  id: string;
  business_id: string;
  slug: string;
  name: string;
};

function asObject(value: unknown): JsonObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mapImportRunRow(row: ImportRunRow): WebsiteImportRunRecord {
  const resultJson = asObject(row.result_json);
  const signalsObject = asObject(row.signals_json);
  const normalizedSignals = {
    emails: asArray(signalsObject.emails),
    phones: asArray(signalsObject.phones),
    addresses: asArray(signalsObject.addresses),
    hours: asArray(signalsObject.hours),
    bookingLinks: asArray(signalsObject.bookingLinks),
    socialLinks: asArray(signalsObject.socialLinks),
    logoCandidates: asArray(signalsObject.logoCandidates),
    faviconCandidates: asArray(signalsObject.faviconCandidates),
    colorCandidates: asArray(signalsObject.colorCandidates),
    fontCandidates: asArray(signalsObject.fontCandidates),
  };

  return {
    id: row.id,
    locationId: row.location_id,
    url: row.url,
    status: row.status,
    error: row.error,
    errorCode: row.error_code,
    source: row.source ?? "knowledge-page",
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    appliedAt: row.applied_at,
    pages: asArray(row.pages_json) as WebsiteImportRunRecord["pages"],
    signals: normalizedSignals as WebsiteImportRunRecord["signals"],
    result: (Object.keys(resultJson).length ? resultJson : null) as WebsiteImportDraft | null,
  };
}

export async function getLocationById(supabase: SupabaseClient, locationId: string) {
  const { data, error } = await supabase
    .from("business_locations")
    .select("id,business_id,slug,name")
    .eq("id", locationId)
    .limit(1)
    .returns<LocationRow[]>();

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

export async function assertMembership(supabase: SupabaseClient, businessId: string, userId: string) {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (error) {
    throw error;
  }

  if (!data?.[0]) {
    throw new Error("Forbidden");
  }
}

export async function getImportRunById(supabase: SupabaseClient, runId: string) {
  const { data, error } = await supabase
    .from("onboarding_import_runs")
    .select("id,location_id,url,status,error,error_code,source,created_at,started_at,finished_at,applied_at,pages_json,signals_json,result_json")
    .eq("id", runId)
    .limit(1)
    .returns<ImportRunRow[]>();

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}
