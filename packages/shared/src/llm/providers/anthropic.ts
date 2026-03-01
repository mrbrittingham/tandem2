import type { LLMRequest, LLMResponse, LLMStreamResponse } from "../types";

export async function generateWithAnthropic(_request: LLMRequest): Promise<LLMResponse> {
  throw new Error("Provider not yet implemented");
}

export async function streamWithAnthropic(_request: LLMRequest): Promise<LLMStreamResponse> {
  throw new Error("Provider not yet implemented");
}
