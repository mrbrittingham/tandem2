type DashboardEnvOptions = {
  requireLLM?: boolean;
};

const RUNBOOK_REF = "RUNBOOK.md#Common-failures";

function createMissingEnvError(envNames: string[]) {
  const joined = envNames.join(", ");
  return new Error(
    `Missing required environment variable(s): ${joined}. Add them to .env.local. See ${RUNBOOK_REF}.`,
  );
}

export function assertDashboardEnv(options?: DashboardEnvOptions): void {
  const missingSupabase = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingSupabase.length > 0) {
    throw createMissingEnvError(missingSupabase);
  }

  const provider = (process.env.LLM_PROVIDER ?? "openai").trim().toLowerCase();
  if (!options?.requireLLM || provider !== "openai") {
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw createMissingEnvError(["OPENAI_API_KEY"]);
  }
}

export function isMissingColumnError(error: { code?: string; message?: string } | null, columnName: string) {
  if (!error) {
    return false;
  }
  if (error.code === "42703") {
    return true;
  }
  return (error.message ?? "").toLowerCase().includes(columnName.toLowerCase());
}

type ScopeFallbackPayload = {
  source: string;
  businessId?: string;
  locationSlug?: string;
  detail?: string;
};

const fallbackCounters = new Map<string, number>();

export function recordScopeFallback(payload: ScopeFallbackPayload): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const counterKey = `${payload.source}:${payload.businessId ?? ""}:${payload.locationSlug ?? ""}`;
  const nextCount = (fallbackCounters.get(counterKey) ?? 0) + 1;
  fallbackCounters.set(counterKey, nextCount);

  console.warn("[scope-fallback] legacy compatibility path used", {
    source: payload.source,
    count: nextCount,
    businessId: payload.businessId,
    locationSlug: payload.locationSlug,
    detail: payload.detail,
  });
}

export function isDevSmokeBypass(request: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if ((process.env.DEV_SMOKE ?? "").trim() !== "1") {
    return false;
  }
  return request.headers.get("x-dev-smoke") === "1";
}