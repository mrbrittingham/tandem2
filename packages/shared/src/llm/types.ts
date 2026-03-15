export type LLMProvider = "openai" | "anthropic" | "google";

export type LLMMessageRole = "user" | "assistant" | "system";

export type LLMMessage = {
  role: LLMMessageRole;
  content: string;
};

export type LLMRequest = {
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export type LLMResponse = {
  text: string;
};

export type LLMStreamResponse = {
  response: Response;
};
