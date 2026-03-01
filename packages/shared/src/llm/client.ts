import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamResponse } from "./types";
import { generateWithOpenAI, streamWithOpenAI } from "./providers/openai";
import { generateWithAnthropic, streamWithAnthropic } from "./providers/anthropic";
import { generateWithGoogle, streamWithGoogle } from "./providers/google";

const DEFAULT_PROVIDER: LLMProvider = "openai";

export async function llmGenerate(request: LLMRequest): Promise<LLMResponse> {
  const provider = (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? DEFAULT_PROVIDER;

  switch (provider) {
    case "openai":
      return generateWithOpenAI(request);
    case "anthropic":
      return generateWithAnthropic(request);
    case "google":
      return generateWithGoogle(request);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export async function llmStream(request: LLMRequest): Promise<LLMStreamResponse> {
  const provider = (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? DEFAULT_PROVIDER;

  switch (provider) {
    case "openai":
      return streamWithOpenAI(request);
    case "anthropic":
      return streamWithAnthropic(request);
    case "google":
      return streamWithGoogle(request);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
