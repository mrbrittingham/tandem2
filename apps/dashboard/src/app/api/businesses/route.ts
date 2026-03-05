import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BusinessRow = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("id,name")
      .order("created_at", { ascending: false })
      .returns<BusinessRow[]>();

    if (error) {
      const message = error.message || "Unknown Supabase error";
      const code = error.code || "unknown";
      return NextResponse.json(
        { error: `Failed to load businesses (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      businesses: (data ?? []).map((business) => ({
        id: business.id,
        name: business.name,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load businesses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
