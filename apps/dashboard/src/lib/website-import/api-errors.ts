export const SCHEMA_OUT_OF_DATE_CODE = "SCHEMA_OUT_OF_DATE" as const;
export const SCHEMA_OUT_OF_DATE_MESSAGE = "Database schema not up to date. Run `npm run db:push`.";

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

function toErrorLike(input: unknown): ErrorLike {
  if (typeof input === "object" && input !== null) {
    return input as ErrorLike;
  }
  return {};
}

function toMessage(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof Error) {
    return input.message;
  }
  const asObject = toErrorLike(input);
  const parts = [asObject.message, asObject.details, asObject.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();

  return parts;
}

export function isSchemaOutOfDateError(input: unknown): boolean {
  const asObject = toErrorLike(input);
  const code = typeof asObject.code === "string" ? asObject.code : "";
  const message = toMessage(input).toLowerCase();

  if (code === "42P01" || code === "42703" || code === "PGRST205") {
    return true;
  }

  return (
    message.includes("onboarding_import_runs") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  )
    || (
      message.includes("business_locations") &&
      message.includes("website_url") &&
      message.includes("does not exist")
    )
    || message.includes("schema cache");
}

export function toApiError(input: unknown, fallbackMessage: string) {
  if (isSchemaOutOfDateError(input)) {
    return {
      status: 503,
      code: SCHEMA_OUT_OF_DATE_CODE,
      message: SCHEMA_OUT_OF_DATE_MESSAGE,
    };
  }

  const message = toMessage(input) || fallbackMessage;
  return {
    status: 500,
    message,
  };
}
