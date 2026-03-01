import { asGuardResponse, requireApiKey } from "@tandem/shared/server";

export function GET(request: Request) {
  try {
    requireApiKey(request);
  } catch (error) {
    const guardResponse = asGuardResponse(error);
    if (guardResponse) {
      return guardResponse;
    }
    return Response.json({ error: "Unknown error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
