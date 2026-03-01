const API_KEY_HEADER = "x-tandem-api-key";

export function jsonError(status: 401 | 403, message: string): Response {
  return Response.json({ error: message }, { status });
}

export function requireApiKey(req: Request): void {
  const configuredApiKey = process.env.TANDEM_API_KEY?.trim();
  if (!configuredApiKey) {
    return;
  }

  const providedApiKey = req.headers.get(API_KEY_HEADER)?.trim();
  if (!providedApiKey || providedApiKey !== configuredApiKey) {
    throw jsonError(401, "missing or invalid API key");
  }
}

const parseAllowedBusinessIds = (): Set<string> => {
  const raw = process.env.TANDEM_ALLOWED_BUSINESS_IDS?.trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
};

export function requireBusinessAllowed(businessId: string | undefined): void {
  const allowedBusinessIds = parseAllowedBusinessIds();
  if (allowedBusinessIds.size === 0) {
    return;
  }

  const trimmedBusinessId = businessId?.trim();
  if (!trimmedBusinessId || !allowedBusinessIds.has(trimmedBusinessId)) {
    throw jsonError(403, "business not allowed");
  }
}

export function asGuardResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null;
}
