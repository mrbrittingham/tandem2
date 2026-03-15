import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runWebsiteImport } from "../../apps/dashboard/src/lib/website-import/run";

type WorkerSupabaseClient = SupabaseClient<any, "public", any>;

type QueuedRun = {
  id: string;
};

type ClaimedRun = {
  id: string;
  location_id: string;
  url: string;
};

type ClassifiedError = {
  code: string;
  message: string;
};

const POLL_INTERVAL_MS = Number(process.env.IMPORT_WORKER_POLL_MS ?? 5000);
const BATCH_SIZE = Number(process.env.IMPORT_WORKER_BATCH_SIZE ?? 5);
const WORKER_ID = process.env.IMPORT_WORKER_ID?.trim() || `worker-${process.pid}`;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

function classifyImportError(error: unknown): ClassifiedError {
  const message = normalizeErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("schema cache")
    || lower.includes("onboarding_import_runs")
    || lower.includes("website_url does not exist")
    || lower.includes("42703")
    || lower.includes("42p01")
    || lower.includes("pgrst205")
  ) {
    return { code: "schema_out_of_date", message };
  }

  if (lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out")) {
    return { code: "timeout", message };
  }

  if (lower.includes("enotfound") || lower.includes("eai_again") || lower.includes("dns")) {
    return { code: "dns_fail", message };
  }

  if (lower.includes("forbidden") || lower.includes("blocked") || lower.includes("robots") || lower.includes("403")) {
    return { code: "blocked", message };
  }

  if (lower.includes("llm") || lower.includes("openai") || lower.includes("provider")) {
    return { code: "llm_error", message };
  }

  if (lower.includes("fetch") || lower.includes("network") || lower.includes("http")) {
    return { code: "fetch_error", message };
  }

  if (lower.includes("json") || lower.includes("parse") || lower.includes("invalid")) {
    return { code: "parse_error", message };
  }

  return { code: "unknown", message };
}

async function listQueuedRuns(client: WorkerSupabaseClient) {
  const { data, error } = await client
    .from("onboarding_import_runs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)
    .returns<QueuedRun[]>();

  if (error) {
    throw new Error(`Failed to load queued import runs: ${error.message}`);
  }

  return data ?? [];
}

async function claimRun(client: WorkerSupabaseClient, runId: string): Promise<ClaimedRun | null> {
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from("onboarding_import_runs")
    .update({
      status: "running",
      started_at: nowIso,
      finished_at: null,
      error: null,
      error_code: null,
    })
    .eq("id", runId)
    .eq("status", "queued")
    .select("id,location_id,url")
    .limit(1)
    .returns<ClaimedRun[]>();

  if (error) {
    throw new Error(`Failed to claim import run ${runId}: ${error.message}`);
  }

  return data?.[0] ?? null;
}

async function markRunSucceeded(
  client: WorkerSupabaseClient,
  run: ClaimedRun,
  result: Awaited<ReturnType<typeof runWebsiteImport>>,
) {
  const finishedAt = new Date().toISOString();

  const { error } = await client
    .from("onboarding_import_runs")
    .update({
      status: "succeeded",
      pages_json: result.pages,
      signals_json: result.signals,
      result_json: result.draft,
      finished_at: finishedAt,
      error: null,
      error_code: null,
    })
    .eq("id", run.id);

  if (error) {
    throw new Error(`Failed to persist import results for run ${run.id}: ${error.message}`);
  }

  await client
    .from("business_locations")
    .update({
      last_import_run_id: run.id,
    })
    .eq("id", run.location_id);
}

async function markRunFailed(client: WorkerSupabaseClient, runId: string, errorInfo: ClassifiedError) {
  const { error } = await client
    .from("onboarding_import_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: errorInfo.message.slice(0, 4000),
      error_code: errorInfo.code,
    })
    .eq("id", runId);

  if (error) {
    console.error("[import-worker] failed to mark run as failed", { runId, error: error.message });
  }
}

async function processRun(client: WorkerSupabaseClient, run: ClaimedRun) {
  try {
    const result = await runWebsiteImport(run.url);
    await markRunSucceeded(client, run, result);

    const pageTypeCounts = result.draft.pageClassification.reduce<Record<string, number>>((accumulator, page) => {
      accumulator[page.pageType] = (accumulator[page.pageType] ?? 0) + 1;
      return accumulator;
    }, {});

    console.info("[import-worker] run succeeded", {
      workerId: WORKER_ID,
      runId: run.id,
      locationId: run.location_id,
      pages: result.pages.length,
      pageTypeCounts,
      events: result.draft.restaurantKnowledge.events.length,
      menuSections: result.draft.restaurantKnowledge.menuSections.length,
      bookingDetected: Boolean(result.draft.restaurantKnowledge.reservations.bookingUrl || result.draft.restaurantKnowledge.reservations.instructions),
      faqs: result.draft.faqs.length,
      policies: result.draft.policies.length,
    });
  } catch (error) {
    const classified = classifyImportError(error);
    await markRunFailed(client, run.id, classified);

    console.error("[import-worker] run failed", {
      workerId: WORKER_ID,
      runId: run.id,
      errorCode: classified.code,
      error: classified.message,
    });
  }
}

async function processBatch(client: WorkerSupabaseClient) {
  const queued = await listQueuedRuns(client);
  if (queued.length === 0) {
    return 0;
  }

  let processed = 0;
  for (const candidate of queued) {
    const claimed = await claimRun(client, candidate.id);
    if (!claimed) {
      continue;
    }

    processed += 1;
    await processRun(client, claimed);
  }

  return processed;
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.info("[import-worker] started", {
    workerId: WORKER_ID,
    pollMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });

  while (true) {
    try {
      const processed = await processBatch(client);
      if (processed > 0) {
        console.info("[import-worker] batch processed", { workerId: WORKER_ID, processed });
      }
    } catch (error) {
      console.error("[import-worker] batch error", {
        workerId: WORKER_ID,
        error: normalizeErrorMessage(error),
      });
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

void main();
