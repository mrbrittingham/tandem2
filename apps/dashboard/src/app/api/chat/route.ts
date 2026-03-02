import { handleChatGet, handleChatPost } from "@tandem/shared/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleChatGet(request, { requireRequestApiKey: false });
}

export async function POST(request: Request) {
  return handleChatPost(request, { requireRequestApiKey: false });
}
