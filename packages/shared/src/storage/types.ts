export type ChatMessageRole = "user" | "assistant" | "system";

export type BusinessRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
  title?: string | null;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  businessId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
};

export type AppendMessageInput = {
  role: ChatMessageRole;
  content: string;
  createdAt?: string;
};

export type UpdateSessionInput = {
  title?: string | null;
  updatedAt?: string;
};

export type ListSessionsOptions = {
  limit?: number;
  cursor?: string | null;
};

export interface ChatStore {
  createSession(businessId: string): Promise<ChatSession>;
  getSession(sessionId: string): Promise<ChatSession | null>;
  listSessions(businessId: string, options?: ListSessionsOptions): Promise<ChatSession[]>;
  appendMessage(sessionId: string, message: AppendMessageInput): Promise<ChatMessage>;
  listMessages(sessionId: string): Promise<ChatMessage[]>;
  updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSession>;
  deleteSession?(sessionId: string): Promise<void>;
}
