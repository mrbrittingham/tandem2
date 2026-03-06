import { createSupabaseChatStore } from "./supabase";
import { createFileChatStore } from "./file";
import { createMemoryChatStore } from "./memory";
import type { ChatStore } from "./types";
export { resolveChatStoreDataDir } from "./file";

let storePromise: Promise<ChatStore> | null = null;

function hasSupabaseServerEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export type ChatStoreSelection = {
  backend: "supabase" | "file";
  dataDir?: string;
};

export function resolveChatStoreSelection(): ChatStoreSelection {
  if (hasSupabaseServerEnv()) {
    return { backend: "supabase" };
  }

  return {
    backend: "file",
  };
}

export async function getChatStore(): Promise<ChatStore> {
  if (!storePromise) {
    const selection = resolveChatStoreSelection();
    if (selection.backend === "supabase") {
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
