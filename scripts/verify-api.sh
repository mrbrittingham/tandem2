#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3100}"
BUSINESS_ID="${BUSINESS_ID:-demo-biz}"
LOCATION_SLUG="${LOCATION_SLUG:-demo-location}"
API_KEY_HEADER="${TANDEM_API_KEY_HEADER:-}"
AUTH_COOKIE="${AUTH_COOKIE:-}"

header_args=()
if [[ -n "$API_KEY_HEADER" ]]; then
  header_args+=("-H" "x-tandem-api-key: $API_KEY_HEADER")
fi

cookie_args=()
if [[ -n "$AUTH_COOKIE" ]]; then
  cookie_args+=("-H" "Cookie: $AUTH_COOKIE")
fi

echo "[verify] BASE_URL=$BASE_URL"
echo "[verify] businessId=$BUSINESS_ID locationSlug=$LOCATION_SLUG"

echo "[verify] GET /api/health"
curl -fsS "${BASE_URL}/api/health" "${header_args[@]}" >/tmp/tandem-health.json
grep -q '"ok":true' /tmp/tandem-health.json

echo "[verify] GET /api/llm-test"
llm_status="$(curl -sS -o /tmp/tandem-llm-get.json -w "%{http_code}" "${BASE_URL}/api/llm-test" "${header_args[@]}")"
if [[ "$llm_status" != "200" && "$llm_status" != "401" && "$llm_status" != "403" ]]; then
  echo "[verify] unexpected /api/llm-test GET status: $llm_status"
  cat /tmp/tandem-llm-get.json
  exit 1
fi

echo "[verify] POST /api/llm-test"
llm_post_status="$(curl -sS -o /tmp/tandem-llm-post.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/llm-test" \
  -H "content-type: application/json" \
  "${header_args[@]}" \
  --data '{}'
)"
if [[ "$llm_post_status" != "200" && "$llm_post_status" != "500" && "$llm_post_status" != "401" && "$llm_post_status" != "403" ]]; then
  echo "[verify] unexpected /api/llm-test POST status: $llm_post_status"
  cat /tmp/tandem-llm-post.json
  exit 1
fi

echo "[verify] GET /api/chat (scoped)"
chat_get_status="$(curl -sS -o /tmp/tandem-chat-get.json -w "%{http_code}" \
  "${BASE_URL}/api/chat?businessId=${BUSINESS_ID}&locationSlug=${LOCATION_SLUG}" \
  "${header_args[@]}" "${cookie_args[@]}")"
if [[ "$chat_get_status" == "200" ]]; then
  grep -q '"businessId"' /tmp/tandem-chat-get.json
  grep -q '"locationSlug"' /tmp/tandem-chat-get.json
elif [[ "$chat_get_status" == "401" || "$chat_get_status" == "403" ]]; then
  echo "[verify] chat GET requires auth ($chat_get_status)."
else
  echo "[verify] unexpected /api/chat GET status: $chat_get_status"
  cat /tmp/tandem-chat-get.json
  exit 1
fi

echo "[verify] POST /api/chat (scoped)"
chat_status="$(curl -sS -o /tmp/tandem-chat-post.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/chat" \
  -H "content-type: application/json" \
  "${header_args[@]}" \
  --data '{"businessId":"'"${BUSINESS_ID}"'","locationSlug":"'"${LOCATION_SLUG}"'","messages":[{"role":"user","content":"Reply with ok"}]}'
)"
if [[ "$chat_status" != "200" && "$chat_status" != "500" && "$chat_status" != "401" && "$chat_status" != "403" ]]; then
  echo "[verify] unexpected /api/chat POST status: $chat_status"
  cat /tmp/tandem-chat-post.json
  exit 1
fi
if [[ "$chat_status" == "401" || "$chat_status" == "403" ]]; then
  echo "[verify] chat POST requires auth ($chat_status)."
fi

echo "[verify] GET /api/conversations (scoped)"
conv_status="$(curl -sS -o /tmp/tandem-conversations.json -w "%{http_code}" \
  "${BASE_URL}/api/conversations?businessId=${BUSINESS_ID}&locationSlug=${LOCATION_SLUG}" \
  "${header_args[@]}" "${cookie_args[@]}")"
if [[ "$conv_status" == "200" ]]; then
  grep -q '"businessId"' /tmp/tandem-conversations.json
  grep -q '"locationSlug"' /tmp/tandem-conversations.json
elif [[ "$conv_status" == "401" ]]; then
  echo "[verify] conversations requires auth (401). Set AUTH_COOKIE to fully verify protected routes."
else
  echo "[verify] unexpected /api/conversations status: $conv_status"
  cat /tmp/tandem-conversations.json
  exit 1
fi

echo "[verify] PASS"