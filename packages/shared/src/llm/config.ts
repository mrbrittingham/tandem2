import type { LLMProvider } from "./types";

const DEFAULT_PROVIDER: LLMProvider = "openai";

type LLMConfigValidationResult =
  | { ok: true; provider: LLMProvider }
  | { ok: false; provider: LLMProvider; message: string; missingEnv: string[] };

export function getConfiguredLLMProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? DEFAULT_PROVIDER;
}

export function validateLLMServerConfig(): LLMConfigValidationResult {
  const provider = getConfiguredLLMProvider();

  if (provider === "openai") {
    const missingEnv = process.env.OPENAI_API_KEY?.trim() ? [] : ["OPENAI_API_KEY"];
    if (missingEnv.length) {
      return {
        ok: false,
        provider,
        message: "Server not configured: missing OPENAI_API_KEY",
        missingEnv,
      };
    }

    return { ok: true, provider };
  }

  if (provider === "anthropic") {
    return {
      ok: false,
      provider,
      message: "Server not configured: provider anthropic is not enabled",
      missingEnv: [],
    };
  }

  if (provider === "google") {
    return {
      ok: false,
      provider,
      message: "Server not configured: provider google is not enabled",
      missingEnv: [],
    };
  }

  return {
    ok: false,
    provider,
    message: `Server not configured: unsupported provider ${provider}`,
    missingEnv: [],
  };
}
