#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL?.trim() || "http://localhost:3100";
const BUSINESS_ID = process.env.BUSINESS_ID?.trim() || "cedar-sage";
const LOCATION_SLUG = process.env.LOCATION_SLUG?.trim() || "valencia-st";
const API_KEY_HEADER = process.env.TANDEM_API_KEY_HEADER?.trim() || "";
const DEV_SMOKE = (process.env.DEV_SMOKE ?? "").trim();

const COMMON_FAILURES_REF = "RUNBOOK.md#Common-failures";

function fail(message) {
  console.error(`\n[smoke:chat] FAIL: ${message}\n`);
  process.exit(1);
}

function info(message) {
  console.log(`[smoke:chat] ${message}`);
}

function ensureRequiredEnv() {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    fail(
      `Missing required environment variable(s): ${missing.join(", ")}. Add them to .env.local. See ${COMMON_FAILURES_REF}.`,
    );
  }

  if (DEV_SMOKE !== "1") {
    fail("DEV_SMOKE=1 is required. Start dashboard with DEV_SMOKE=1 npm run dev, then rerun smoke.");
  }
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function bodyPreview(text) {
  if (!text) {
    return "<empty body>";
  }
  return text.length > 400 ? `${text.slice(0, 400)}...` : text;
}

function buildHeaders(extra = {}) {
  const headers = {
    "x-dev-smoke": "1",
    ...extra,
  };
  if (API_KEY_HEADER) {
    headers["x-tandem-api-key"] = API_KEY_HEADER;
  }
  return headers;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = parseJsonSafe(text);
  return { response, text, json };
}

async function main() {
  ensureRequiredEnv();

  info(`baseUrl=${BASE_URL}`);
  info(`scope businessId=${BUSINESS_ID} locationSlug=${LOCATION_SLUG}`);

  const health = await request(`${BASE_URL}/api/health`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!health.response.ok || health.json?.ok !== true) {
    fail(
      `Health check failed (${health.response.status}). Ensure dashboard server is running (npm run dev). Body: ${bodyPreview(health.text)}`,
    );
  }

  const marker = `smoke-chat-${Date.now()}`;
  const userMessage = `LOCAL_SMOKE:${marker}`;

  info("POST /api/chat");
  const chatPost = await request(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: buildHeaders({
      "content-type": "application/json",
    }),
    body: JSON.stringify({
      businessId: BUSINESS_ID,
      locationSlug: LOCATION_SLUG,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!chatPost.response.ok) {
    fail(`POST /api/chat failed (${chatPost.response.status}). ${bodyPreview(chatPost.text)}`);
  }

  const sessionId = chatPost.json?.sessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    fail(`POST /api/chat did not return sessionId. Body: ${bodyPreview(chatPost.text)}`);
  }

  info("GET /api/conversations");
  const list = await request(
    `${BASE_URL}/api/conversations?businessId=${encodeURIComponent(BUSINESS_ID)}&locationSlug=${encodeURIComponent(LOCATION_SLUG)}`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!list.response.ok) {
    fail(`GET /api/conversations failed (${list.response.status}). ${bodyPreview(list.text)}`);
  }

  const sessions = Array.isArray(list.json?.sessions) ? list.json.sessions : [];
  const foundSession = sessions.some((entry) => entry?.id === sessionId);
  if (!foundSession) {
    fail(`Conversation list did not contain sessionId ${sessionId}.`);
  }

  info("GET /api/conversations/{sessionId}");
  const detail = await request(
    `${BASE_URL}/api/conversations/${encodeURIComponent(sessionId)}?businessId=${encodeURIComponent(BUSINESS_ID)}&locationSlug=${encodeURIComponent(LOCATION_SLUG)}`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!detail.response.ok) {
    fail(`GET /api/conversations/{sessionId} failed (${detail.response.status}). ${bodyPreview(detail.text)}`);
  }

  const detailMessages = Array.isArray(detail.json?.messages) ? detail.json.messages : [];
  const foundPostedInDetail = detailMessages.some((entry) => entry?.content === userMessage);
  if (!foundPostedInDetail) {
    fail("Conversation detail did not include the posted smoke message.");
  }

  info(`PASS sessionId=${sessionId}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Unexpected error: ${message}`);
});
