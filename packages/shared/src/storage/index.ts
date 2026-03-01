import { createFileChatStore } from "./file";
import { createMemoryChatStore } from "./memory";
import type { ChatStore } from "./types";

let storePromise: Promise<ChatStore> | null = null;

export async function getChatStore(): Promise<ChatStore> {
  if (!storePromise) {
    storePromise = createFileChatStore().catch((error) => {
      console.warn("Falling back to in-memory chat store", error);
      return createMemoryChatStore();
    });
  }
  return storePromise;
}

export type {
  AppendMessageInput,
  ChatMessage,
  ChatMessageRole,
  ChatSession,
  ChatStore,
  ListSessionsOptions,
  UpdateSessionInput,
} from "./types";
