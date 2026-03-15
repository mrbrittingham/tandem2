import type { LLMRequest, LLMResponse, LLMStreamResponse } from "../types";

export async function generateWithGoogle(_request: LLMRequest): Promise<LLMResponse> {
  throw new Error("Provider not yet implemented");
}

export async function streamWithGoogle(_request: LLMRequest): Promise<LLMStreamResponse> {
  throw new Error("Provider not yet implemented");
}
