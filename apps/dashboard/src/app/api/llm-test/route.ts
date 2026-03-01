import { asGuardResponse, llmGenerate, requireApiKey } from "@tandem/shared/server";

const provider = process.env.LLM_PROVIDER ?? "openai";
const model = process.env.LLM_MODEL ?? "gpt-5.2";
const hasKey = Boolean(process.env.OPENAI_API_KEY);

export function GET(request: Request) {
  try {
    requireApiKey(request);
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }
    return Response.json({ error: "Unknown error" }, { status: 500 });
  }

  return Response.json({ provider, model, hasKey });
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    requireApiKey(request);

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
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ provider, model, error: message }, { status: 500 });
  }
}
