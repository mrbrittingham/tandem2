import { llmGenerate } from "@tandem/shared/server";

// Read env vars at request time — never capture at module level.
// These values must be fresh on every call so .env.local changes
// and Replit Secrets are always reflected without a server restart.
function getRuntimeEnv() {
  return {
    provider: process.env.LLM_PROVIDER ?? "openai",
    model: process.env.LLM_MODEL ?? "gpt-4o",
    hasKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

// This route lives inside the dashboard and is protected by Supabase
// auth middleware (see proxy.ts). No additional TANDEM_API_KEY guard
// is needed here — that check is for external script access only.
export function GET() {
  return Response.json(getRuntimeEnv());
}

export async function POST() {
  const startedAt = Date.now();
  const { provider, model } = getRuntimeEnv();

  try {
    const { text } = await llmGenerate({
      system: "You are Tandem's status assistant.",
      messages: [
        {
          role: "user",
          content: "Return a short sentence confirming the LLM is connected.",
        },
      ],
      temperature: 0.2,
      maxTokens: 120,
    });

    const latencyMs = Date.now() - startedAt;

    return Response.json({ provider, model, latencyMs, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ provider, model, error: message }, { status: 500 });
  }
}
