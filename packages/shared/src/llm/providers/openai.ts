import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import type { LLMRequest, LLMResponse, LLMStreamResponse } from "../types";

// Lazily create the client on each call so the API key is always read fresh
// from process.env at request time — avoids capturing a stale/undefined value
// when the module is first imported before .env.local is parsed.
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return createOpenAI({ apiKey });
}

const getModel = () => process.env.LLM_MODEL || "gpt-5.2";

const baseOptions = (request: LLMRequest) => ({
  system: request.system,
  messages: request.messages,
  temperature: request.temperature,
  maxOutputTokens: request.maxTokens,
});

export async function generateWithOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const client = getOpenAIClient();
  const model = getModel();

  const { text } = await generateText({
    model: client(model),
    ...baseOptions(request),
  });

  return { text };
}

export async function streamWithOpenAI(request: LLMRequest): Promise<LLMStreamResponse> {
  const client = getOpenAIClient();
  const model = getModel();

  const result = await streamText({
    model: client(model),
    ...baseOptions(request),
  });

  return { response: result.toTextStreamResponse() };
}
