import { randomUUID } from "node:crypto";
import { getServerSupabaseClient } from "../supabase/server";
import { isMissingColumnError, recordScopeFallback } from "../server/guardrails";
import type {
  AppendMessageInput,
  ChatMessage,
  ChatSession,
  ChatStore,
  ListSessionsOptions,
  UpdateSessionInput,
} from "./types";

type SupabaseError = {
  code?: string | null;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type SessionRow = {
  id: string;
  business_id: string;
  location_slug?: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  business_id: string;
  role: ChatMessage["role"];
  content: string;
  created_at: string;
};

type BusinessRow = {
  id: string;
  name: string;
  slug?: string;
  created_at: string;
};

const BUSINESSES_TABLE = "businesses";
const SESSIONS_TABLE = "chat_sessions";
const MESSAGES_TABLE = "chat_messages";

function toBusinessSlug(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length > 0) {
    return normalized;
  }

  // Keep a deterministic fallback slug when businessId has no slug-safe chars.
  const compact = input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `business-${(compact || "id").slice(0, 12)}`;
}

function asSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    businessId: row.business_id,
    locationSlug: row.location_slug ?? undefined,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    businessId: row.business_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function toError(operation: string, table: string, error: SupabaseError | null): never {
  const code = error?.code ?? "unknown";
  const message = error?.message ?? "Unknown Supabase error";
  const details = error?.details ? ` | details: ${error.details}` : "";
  const hint = error?.hint ? ` | hint: ${error.hint}` : "";
  throw new Error(`Supabase ${operation} on ${table} failed (code: ${code}): ${message}${details}${hint}`);
}

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === "PGRST116";
}

export function createSupabaseChatStore(): ChatStore {
  const supabase = getServerSupabaseClient();

  const ensureBusinessExists = async (businessId: string) => {
    const payload = {
      id: businessId,
      name: businessId,
      slug: toBusinessSlug(businessId),
    } satisfies Omit<BusinessRow, "created_at">;

    const withSlugUpsert = await supabase
      .from(BUSINESSES_TABLE)
      .upsert(payload, { onConflict: "id", ignoreDuplicates: true });

    if (withSlugUpsert.error && isMissingColumnError(withSlugUpsert.error, "slug")) {
      recordScopeFallback({
        source: "storage:supabase:ensureBusinessExists",
        businessId,
        detail: "businesses.slug is unavailable; using legacy upsert shape",
      });

      const fallbackPayload = {
        id: businessId,
        name: businessId,
      } satisfies Omit<BusinessRow, "created_at">;

      const fallbackUpsert = await supabase
        .from(BUSINESSES_TABLE)
        .upsert(fallbackPayload, { onConflict: "id", ignoreDuplicates: true });

      if (fallbackUpsert.error) {
        toError("upsert", BUSINESSES_TABLE, fallbackUpsert.error);
      }

      return;
    }

    if (withSlugUpsert.error) {
      toError("upsert", BUSINESSES_TABLE, withSlugUpsert.error);
    }
  };

  return {
    async createSession(businessId, options) {
      await ensureBusinessExists(businessId);

      const timestamp = new Date().toISOString();
      const payload = {
        id: randomUUID(),
        business_id: businessId,
        location_slug: options?.locationSlug ?? null,
        title: null,
        created_at: timestamp,
        updated_at: timestamp,
      };

      const withLocationInsert = await supabase
        .from(SESSIONS_TABLE)
        .insert(payload)
        .select("id,business_id,location_slug,title,created_at,updated_at")
        .single<SessionRow>();

      if (withLocationInsert.error && isMissingColumnError(withLocationInsert.error, "location_slug")) {
        recordScopeFallback({
          source: "storage:supabase:createSession",
          businessId,
          locationSlug: options?.locationSlug,
          detail: "chat_sessions.location_slug is unavailable; using legacy insert shape",
        });

        const fallbackPayload = {
          id: payload.id,
          business_id: payload.business_id,
          title: payload.title,
          created_at: payload.created_at,
          updated_at: payload.updated_at,
        };

        const fallbackInsert = await supabase
          .from(SESSIONS_TABLE)
          .insert(fallbackPayload)
          .select("id,business_id,title,created_at,updated_at")
          .single<SessionRow>();

        if (fallbackInsert.error || !fallbackInsert.data) {
          toError("insert", SESSIONS_TABLE, fallbackInsert.error);
        }

        return asSession(fallbackInsert.data);
      }

      if (withLocationInsert.error || !withLocationInsert.data) {
        toError("insert", SESSIONS_TABLE, withLocationInsert.error);
      }

      return asSession(withLocationInsert.data);
    },

    async getSession(sessionId) {
      const withLocationSelect = await supabase
        .from(SESSIONS_TABLE)
        .select("id,business_id,location_slug,title,created_at,updated_at")
        .eq("id", sessionId)
        .single<SessionRow>();

      if (withLocationSelect.error && isMissingColumnError(withLocationSelect.error, "location_slug")) {
        recordScopeFallback({
          source: "storage:supabase:getSession",
          detail: "chat_sessions.location_slug is unavailable; using legacy select shape",
        });

        const fallbackSelect = await supabase
          .from(SESSIONS_TABLE)
          .select("id,business_id,title,created_at,updated_at")
          .eq("id", sessionId)
          .single<SessionRow>();

        if (fallbackSelect.error) {
          if (isNoRowsError(fallbackSelect.error)) {
            return null;
          }
          toError("select", SESSIONS_TABLE, fallbackSelect.error);
        }

        return fallbackSelect.data ? asSession(fallbackSelect.data) : null;
      }

      if (withLocationSelect.error) {
        if (isNoRowsError(withLocationSelect.error)) {
          return null;
        }
        toError("select", SESSIONS_TABLE, withLocationSelect.error);
      }

      return withLocationSelect.data ? asSession(withLocationSelect.data) : null;
    },

    async listSessions(businessId, options?: ListSessionsOptions) {
      await ensureBusinessExists(businessId);

      const limit = options?.limit ?? 20;
      const withLocationList = await supabase
        .from(SESSIONS_TABLE)
        .select("id,business_id,location_slug,title,created_at,updated_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false })
        .limit(limit)
        .returns<SessionRow[]>();

      if (withLocationList.error && isMissingColumnError(withLocationList.error, "location_slug")) {
        recordScopeFallback({
          source: "storage:supabase:listSessions",
          businessId,
          detail: "chat_sessions.location_slug is unavailable; using legacy list shape",
        });

        const fallbackList = await supabase
          .from(SESSIONS_TABLE)
          .select("id,business_id,title,created_at,updated_at")
          .eq("business_id", businessId)
          .order("updated_at", { ascending: false })
          .limit(limit)
          .returns<SessionRow[]>();

        if (fallbackList.error) {
          toError("select", SESSIONS_TABLE, fallbackList.error);
        }

        return (fallbackList.data ?? []).map(asSession);
      }

      if (withLocationList.error) {
        toError("select", SESSIONS_TABLE, withLocationList.error);
      }

      return (withLocationList.data ?? []).map(asSession);
    },

    async appendMessage(sessionId, messageInput: AppendMessageInput) {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const createdAt = messageInput.createdAt ?? new Date().toISOString();
      const messagePayload = {
        id: randomUUID(),
        session_id: sessionId,
        business_id: session.businessId,
        role: messageInput.role,
        content: messageInput.content,
        created_at: createdAt,
      };

      const { data: messageData, error: messageError } = await supabase
        .from(MESSAGES_TABLE)
        .insert(messagePayload)
        .select("id,session_id,business_id,role,content,created_at")
        .single<MessageRow>();

      if (messageError || !messageData) {
        toError("insert", MESSAGES_TABLE, messageError);
      }

      const { error: sessionError } = await supabase
        .from(SESSIONS_TABLE)
        .update({ updated_at: createdAt })
        .eq("id", sessionId);

      if (sessionError) {
        toError("update", SESSIONS_TABLE, sessionError);
      }

      return asMessage(messageData);
    },

    async listMessages(sessionId) {
      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .select("id,session_id,business_id,role,content,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>();

      if (error) {
        toError("select", MESSAGES_TABLE, error);
      }

      return (data ?? []).map(asMessage);
    },

    async updateSession(sessionId, patch: UpdateSessionInput) {
      const updates: { title?: string | null; updated_at: string } = {
        updated_at: patch.updatedAt ?? new Date().toISOString(),
      };

      if (patch.title !== undefined) {
        updates.title = patch.title;
      }

      const { data, error } = await supabase
        .from(SESSIONS_TABLE)
        .update(updates)
        .eq("id", sessionId)
        .select("id,business_id,title,created_at,updated_at")
        .single<SessionRow>();

      if (error || !data) {
        toError("update", SESSIONS_TABLE, error);
      }

      return asSession(data);
    },

    async deleteSession(sessionId) {
      const { error: deleteMessagesError } = await supabase
        .from(MESSAGES_TABLE)
        .delete()
        .eq("session_id", sessionId);

      if (deleteMessagesError) {
        toError("delete", MESSAGES_TABLE, deleteMessagesError);
      }

      const { error: deleteSessionError } = await supabase
        .from(SESSIONS_TABLE)
        .delete()
        .eq("id", sessionId);

      if (deleteSessionError) {
        toError("delete", SESSIONS_TABLE, deleteSessionError);
      }
    },
  } satisfies ChatStore;
}
