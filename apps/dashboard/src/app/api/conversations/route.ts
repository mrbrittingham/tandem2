import { NextResponse } from "next/server";
import {
  asGuardResponse,
  getChatStore,
  requireApiKey,
  requireBusinessAllowed,
} from "@tandem/shared/server";

const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  try {
    requireApiKey(request);

    const url = new URL(request.url);
    const businessId = (url.searchParams.get("businessId") ?? "").trim();

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    requireBusinessAllowed(businessId);

    const store = await getChatStore();
    const sessions = await store.listSessions(businessId, { limit: DEFAULT_LIMIT });

    const ordered = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({
      businessId,
      sessions: ordered.map((session) => ({
        id: session.id,
        businessId: session.businessId,
        title: session.title ?? null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
    });
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }

    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
