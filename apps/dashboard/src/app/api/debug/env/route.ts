import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    provider: process.env.LLM_PROVIDER ?? null,
    model: process.env.LLM_MODEL ?? null,
    cwd: process.cwd(),
  });
}
