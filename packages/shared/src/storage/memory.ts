import { randomUUID } from "node:crypto";
import type {
  AppendMessageInput,
  ChatMessage,
  ChatSession,
  ChatStore,
  ListSessionsOptions,
  UpdateSessionInput,
} from "./types";

const createId = () => randomUUID();

const sortSessions = (sessions: ChatSession[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const cloneSession = (session: ChatSession): ChatSession => ({ ...session });
const cloneMessage = (message: ChatMessage): ChatMessage => ({ ...message });

export function createMemoryChatStore(): ChatStore {
  const sessions = new Map<string, ChatSession>();
  const messages = new Map<string, ChatMessage[]>();

  return {
    async createSession(businessId) {
      const timestamp = new Date().toISOString();
      const session: ChatSession = {
        id: createId(),
        businessId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      sessions.set(session.id, session);
      messages.set(session.id, []);
      return cloneSession(session);
    },

    async getSession(sessionId) {
      const session = sessions.get(sessionId);
      return session ? cloneSession(session) : null;
    },

    async listSessions(businessId, options?: ListSessionsOptions) {
      const limit = options?.limit ?? 20;
      const filtered = Array.from(sessions.values()).filter((session) => session.businessId === businessId);
      return sortSessions(filtered).slice(0, limit).map(cloneSession);
    },

    async appendMessage(sessionId, messageInput) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      const createdAt = messageInput.createdAt ?? new Date().toISOString();
      const message: ChatMessage = {
        id: createId(),
        sessionId,
        businessId: session.businessId,
        role: messageInput.role,
        content: messageInput.content,
        createdAt,
      };
      const list = messages.get(sessionId) ?? [];
      list.push(message);
      messages.set(sessionId, list);
      session.updatedAt = createdAt;
      sessions.set(sessionId, session);
      return cloneMessage(message);
    },

    async listMessages(sessionId) {
      const list = messages.get(sessionId) ?? [];
      return list.map(cloneMessage).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    async updateSession(sessionId, patch: UpdateSessionInput) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      const next: ChatSession = {
        ...session,
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      sessions.set(sessionId, next);
      return cloneSession(next);
    },

    async deleteSession(sessionId) {
      sessions.delete(sessionId);
      messages.delete(sessionId);
    },
  } satisfies ChatStore;
}
