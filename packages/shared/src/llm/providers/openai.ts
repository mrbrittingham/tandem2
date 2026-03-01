import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import type { LLMRequest, LLMResponse, LLMStreamResponse } from "../types";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getModel = () => process.env.LLM_MODEL || "gpt-5.2";

const baseOptions = (request: LLMRequest) => ({
  system: request.system,
  messages: request.messages,
  temperature: request.temperature,
  maxOutputTokens: request.maxTokens,
});

function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
}

export async function generateWithOpenAI(request: LLMRequest): Promise<LLMResponse> {
  ensureApiKey();
  const model = getModel();

  const { text } = await generateText({
    model: openai(model),
    ...baseOptions(request),
  });

  return { text };
}

export async function streamWithOpenAI(request: LLMRequest): Promise<LLMStreamResponse> {
  ensureApiKey();
  const model = getModel();

  const result = await streamText({
    model: openai(model),
    ...baseOptions(request),
  });

  return { response: result.toTextStreamResponse() };
}
