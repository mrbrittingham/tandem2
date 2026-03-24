import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolved model values mirror the actual call-site fallback chains:
  //   widget:   LLM_MODEL_WIDGET -> LLM_MODEL -> "gpt-4o"
  //   operator: LLM_MODEL_OPERATOR -> LLM_MODEL -> "gpt-4o"
  //   global:   LLM_MODEL -> "gpt-4o"
  const globalModel = process.env.LLM_MODEL ?? "gpt-4o";

  return NextResponse.json({
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    provider: process.env.LLM_PROVIDER ?? null,
    // Raw env values — null means not set (will fall back to next in chain)
    llmModel: process.env.LLM_MODEL ?? null,
    llmModelWidget: process.env.LLM_MODEL_WIDGET ?? null,
    llmModelOperator: process.env.LLM_MODEL_OPERATOR ?? null,
    // Effective values — what each surface will actually use at runtime
    resolvedModelGlobal: globalModel,
    resolvedModelWidget: process.env.LLM_MODEL_WIDGET ?? globalModel,
    resolvedModelOperator: process.env.LLM_MODEL_OPERATOR ?? globalModel,
    cwd: process.cwd(),
  });
}
