import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  asGuardResponse,
  getChatStore,
  requireApiKey,
  requireBusinessAllowed,
} from "@tandem/shared/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId?: string }> }) {
  try {
    requireApiKey(request);

    const resolvedParams = await params;
    const pathSegment = new URL(request.url).pathname.split("/").filter(Boolean).pop();
    const trimmedSessionId = (resolvedParams?.sessionId ?? pathSegment ?? "").trim();

    if (!trimmedSessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const store = await getChatStore();
    const session = await store.getSession(trimmedSessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    requireBusinessAllowed(session.businessId);

    const messages = await store.listMessages(trimmedSessionId);

    return NextResponse.json({
      session: {
        id: session.id,
        businessId: session.businessId,
        title: session.title ?? null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }

    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
