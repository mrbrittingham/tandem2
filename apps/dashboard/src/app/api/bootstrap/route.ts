import { NextResponse } from "next/server";
import { assertDashboardEnv } from "@tandem/shared/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUSINESS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const ROLE_PATTERN = /^(owner|admin|member)$/;

type BootstrapRequestBody = {
  businessId?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    assertDashboardEnv();

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: BootstrapRequestBody;
    try {
      body = (await request.json()) as BootstrapRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const businessId = (body.businessId ?? "").trim();
    const role = (body.role ?? "owner").trim();

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    if (!BUSINESS_ID_PATTERN.test(businessId)) {
      return NextResponse.json({ error: "businessId is invalid" }, { status: 400 });
    }

    if (!ROLE_PATTERN.test(role)) {
      return NextResponse.json({ error: "role is invalid" }, { status: 400 });
    }

    const { error } = await supabase.rpc("bootstrap_membership", {
      business_id: businessId,
      role,
    });

    if (error) {
      const code = error.code || "unknown";
      const message = error.message || "Unknown Supabase error";
      return NextResponse.json(
        { error: `Failed to bootstrap membership (code: ${code}): ${message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, businessId, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap membership";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
