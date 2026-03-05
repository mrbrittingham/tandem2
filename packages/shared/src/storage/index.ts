import { createSupabaseChatStore } from "./supabase";
import { createFileChatStore } from "./file";
import { createMemoryChatStore } from "./memory";
import type { ChatStore } from "./types";

let storePromise: Promise<ChatStore> | null = null;

function hasSupabaseServerEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export async function getChatStore(): Promise<ChatStore> {
  if (!storePromise) {
    if (hasSupabaseServerEnv()) {
      storePromise = Promise.resolve(createSupabaseChatStore());
    } else {
      storePromise = createFileChatStore().catch((error) => {
        console.warn("Falling back to in-memory chat store (Supabase env not configured)", error);
        return createMemoryChatStore();
      });
    }
  }
  return storePromise;
}

export type {
  AppendMessageInput,
  ChatMessage,
  ChatMessageRole,
  ChatSession,
  ChatStore,
  CreateSessionOptions,
  ListSessionsOptions,
  UpdateSessionInput,
} from "./types";
