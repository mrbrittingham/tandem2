import { getChatStore } from "../storage";
import { llmStream, type LLMMessage } from "../llm";
import { asGuardResponse, requireApiKey, requireBusinessAllowed } from "./auth";

const SESSION_COOKIE = "tandem_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MESSAGE_CONTEXT_LIMIT = 50;
type ChatRequestBody = {
  businessId?: string;
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
};

const sanitizeBusinessId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const buildSessionCookie = (sessionId: string) => {
  const directives = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (process.env.NODE_ENV === "production") {
    directives.push("Secure");
  }

  return directives.join("; ");
};

const getCookieValue = (req: Request, cookieName: string): string | undefined => {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  const chunks = cookieHeader.split(";");
  for (const chunk of chunks) {
    const [key, ...rest] = chunk.trim().split("=");
    if (key !== cookieName) {
      continue;
    }
    const value = rest.join("=");
    return value ? decodeURIComponent(value) : undefined;
  }

  return undefined;
};

async function ensureSession(req: Request, businessId: string) {
  const store = await getChatStore();
  const sessionIdFromCookie = getCookieValue(req, SESSION_COOKIE);
  let created = false;

  if (sessionIdFromCookie) {
    const existing = await store.getSession(sessionIdFromCookie);
    if (existing && existing.businessId === businessId) {
      return { store, session: existing, created };
    }
  }

  const session = await store.createSession(businessId);
  created = true;
  return { store, session, created };
}

function readBusinessIdFromGet(req: Request): string | undefined {
  const url = new URL(req.url);
  return sanitizeBusinessId(url.searchParams.get("businessId") ?? undefined);
}

export async function handleChatGet(req: Request): Promise<Response> {
  try {
    requireApiKey(req);
    const businessId = readBusinessIdFromGet(req);
    if (!businessId) {
      return Response.json({ error: "businessId required" }, { status: 400 });
    }

    requireBusinessAllowed(businessId);

    const { session, store, created } = await ensureSession(req, businessId);
    const messages = await store.listMessages(session.id);

    const response = Response.json({
      sessionId: session.id,
      businessId: session.businessId,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });

    if (created) {
      response.headers.append("Set-Cookie", buildSessionCookie(session.id));
    }

    return response;
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }

    const message = error instanceof Error ? error.message : "Failed to load session";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function handleChatPost(req: Request): Promise<Response> {
  try {
    requireApiKey(req);

    let body: ChatRequestBody;
    try {
      body = (await req.json()) as ChatRequestBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const businessId = sanitizeBusinessId(body.businessId);
    if (!businessId) {
      return Response.json({ error: "businessId required" }, { status: 400 });
    }

    requireBusinessAllowed(businessId);

    const userMessages = (body.messages ?? []).filter(
      (message) => message.role === "user" && typeof message.content === "string" && message.content.trim().length > 0,
    );

    if (!userMessages.length) {
      return Response.json({ error: "messages are required" }, { status: 400 });
    }

    const { session, store, created } = await ensureSession(req, businessId);

    for (const message of userMessages) {
      await store.appendMessage(session.id, {
        role: "user",
        content: message.content,
      });

      if (!session.title) {
        const snippet = message.content.trim().slice(0, 80);
        if (snippet) {
          await store.updateSession(session.id, { title: snippet });
          session.title = snippet;
        }
      }
    }

    const history = await store.listMessages(session.id);
    const recentHistory = history.slice(-MESSAGE_CONTEXT_LIMIT).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const { response: baseResponse } = await llmStream({
      messages: recentHistory,
      system: body.system,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      stream: true,
    });

    if (!baseResponse.body) {
      throw new Error("LLM stream unavailable");
    }

    const reader = baseResponse.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    let aborted = false;

    const proxyStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            if (value) {
              assistantText += decoder.decode(value, { stream: true });
              controller.enqueue(value);
            }
          }
          assistantText += decoder.decode();
          controller.close();
          if (!aborted && assistantText.trim().length > 0) {
            await store.appendMessage(session.id, {
              role: "assistant",
              content: assistantText,
            });
          }
        } catch (error) {
          aborted = true;
          controller.error(error);
          await reader.cancel(error);
        }
      },
      async cancel(reason) {
        aborted = true;
        await reader.cancel(reason);
      },
    });

    const headers = new Headers(baseResponse.headers);
    if (created) {
      headers.append("Set-Cookie", buildSessionCookie(session.id));
    }

    return new Response(proxyStream, {
      headers,
      status: baseResponse.status,
      statusText: baseResponse.statusText,
    });
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
