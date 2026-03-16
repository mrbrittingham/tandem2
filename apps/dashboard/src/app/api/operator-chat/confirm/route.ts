/**
 * POST /api/operator-chat/confirm
 *
 * Executes a confirmed operator AI tool call against the location config in Supabase.
 * This route is the write boundary for all operator AI tool changes.
 *
 * Security controls:
 * 1. Requires a valid Supabase session (authenticated user).
 * 2. Looks up which business owns the requested locationId.
 * 3. Verifies the authenticated user is a member of that business.
 * 4. Validates the toolName against the allowed list.
 * 5. Validates toolArgs in the tool executor (unknown fields dropped, lengths capped).
 * 6. Logs every confirmed execution (userId, locationId, toolName, changedFields).
 *
 * NOTE: Rate limiting (30 confirmed writes per user per hour) is deferred.
 * Add before production launch of Tandem 3.0.
 * See RUNBOOK.md — Operator AI Tool Rate Limiting (deferred).
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  executeOperatorTool,
  type ToolExecutorResult,
} from "@/lib/operator-tools/tool-executor";
import {
  OPERATOR_TOOL_NAMES,
  type PendingChange,
  type OperatorToolName,
} from "@/lib/operator-tools/tool-definitions";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

type ConfirmBody = {
  pendingChange?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidPendingChange(v: unknown): v is PendingChange {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    obj.type === "pending_change" &&
    typeof obj.toolName === "string" &&
    typeof obj.locationId === "string" &&
    obj.locationId.length > 0 &&
    typeof obj.toolArgs === "object" &&
    obj.toolArgs !== null
  );
}

// ---------------------------------------------------------------------------
// Membership verification
// ---------------------------------------------------------------------------

type BusinessLocationRow = { id: string; business_id: string };
type MembershipRow = { business_id: string };

async function verifyUserCanWriteLocation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  locationId: string,
): Promise<{ ok: true; businessId: string } | { ok: false; response: NextResponse }> {
  // 1. Find the business that owns this location
  const { data: locationRow, error: locationError } = await supabase
    .from("business_locations")
    .select("id, business_id")
    .eq("id", locationId)
    .maybeSingle<BusinessLocationRow>();

  if (locationError || !locationRow) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Location not found" }, { status: 404 }),
    };
  }

  // 2. Verify the user is a member of that business
  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .eq("business_id", locationRow.business_id)
    .maybeSingle<MembershipRow>();

  if (membershipError || !membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Access denied: you are not a member of this business" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, businessId: locationRow.business_id };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pendingChange } = body;

  if (!isValidPendingChange(pendingChange)) {
    return NextResponse.json(
      { error: "pendingChange is required and must be a valid PendingChange object" },
      { status: 400 },
    );
  }

  const locationId = asString(pendingChange.locationId);
  const toolName = asString(pendingChange.toolName);
  const toolArgs = pendingChange.toolArgs as Record<string, unknown>;

  // ── Validate tool name ────────────────────────────────────────────────
  if (!(OPERATOR_TOOL_NAMES as readonly string[]).includes(toolName)) {
    return NextResponse.json(
      { error: `Unknown tool: "${toolName}"` },
      { status: 400 },
    );
  }

  // ── Verify the authenticated user can write to this location ──────────
  const authCheck = await verifyUserCanWriteLocation(supabase, user.id, locationId);
  if (!authCheck.ok) {
    return authCheck.response;
  }

  // ── Execute the tool ──────────────────────────────────────────────────
  let executorResult: ToolExecutorResult;
  try {
    executorResult = await executeOperatorTool(
      toolName as OperatorToolName,
      toolArgs,
      locationId,
      supabase,
    );
  } catch (execError) {
    const message =
      execError instanceof Error ? execError.message : "Tool execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── Log the confirmed execution ───────────────────────────────────────
  console.info("[operator-chat/confirm]", {
    userId: user.id,
    locationId,
    businessId: authCheck.businessId,
    toolName,
    changedFields: executorResult.changedFields,
    humanSummary: pendingChange.humanSummary ?? "",
  });

  // ── Return success ─────────────────────────────────────────────────────
  // Return only the changed config sections to minimize sensitive data exposure.
  return NextResponse.json({
    ok: true,
    updatedConfig: executorResult.updatedConfig,
  });
}
