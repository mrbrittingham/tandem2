import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractMenuFromText } from "@/lib/website-import/extract";

export const runtime = "nodejs";

type Body = {
  /** Raw text pasted by operator */
  text?: string;
  /** URL to fetch and extract menu from */
  url?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawText = (body.text ?? "").trim();
  const rawUrl = (body.url ?? "").trim();

  if (!rawText && !rawUrl) {
    return NextResponse.json({ error: "Provide either 'text' or 'url'" }, { status: 400 });
  }

  let menuText = rawText;
  let sourceUrl: string | null = null;

  if (rawUrl) {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }
    sourceUrl = parsedUrl.toString();

    try {
      const resp = await fetch(sourceUrl, {
        headers: { Accept: "text/html, text/plain" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) {
        return NextResponse.json({ error: `Failed to fetch URL (${resp.status})` }, { status: 422 });
      }
      const html = await resp.text();
      // Strip HTML tags to get plain text
      menuText = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return NextResponse.json({ error: `Could not fetch URL: ${message}` }, { status: 422 });
    }
  }

  if (menuText.length < 10) {
    return NextResponse.json({ error: "Not enough text to extract a menu" }, { status: 422 });
  }

  try {
    const sections = await extractMenuFromText(menuText, sourceUrl);
    return NextResponse.json({ ok: true, sections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
