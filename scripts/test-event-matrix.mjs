#!/usr/bin/env node
/**
 * Event-answering test matrix for Windmill Creek Winery chatbot.
 * Runs each prompt against the live /api/chat endpoint and records results.
 */

const BASE_URL = "http://localhost:3100";
const BUSINESS_SLUG = "windmill-creek-winery";
const LOCATION_SLUG = "windmill-creek-10";

const PROMPTS = [
  // -- General event queries --
  { id: "GEN-01", label: "general upcoming", msg: "what events are coming up?" },
  { id: "GEN-02", label: "general upcoming soon", msg: "what events are coming up soon?" },
  { id: "GEN-03", label: "this month", msg: "what's happening this month?" },
  { id: "GEN-04", label: "next three months", msg: "what's happening in the next three months?" },
  { id: "GEN-05", label: "this weekend", msg: "what do you have going on this weekend?" },

  // -- Live music / category queries --
  { id: "CAT-01", label: "any live music", msg: "any live music?" },
  { id: "CAT-02", label: "any bands coming up", msg: "any bands coming up?" },
  { id: "CAT-03", label: "who is playing soon", msg: "who is playing soon?" },
  { id: "CAT-04", label: "performers coming up", msg: "do you have any performers coming up?" },
  { id: "CAT-05", label: "live entertainment", msg: "what live entertainment do you have?" },

  // -- Named event / act queries (lowercase, as real users type) --
  { id: "NAM-01", label: "the outliers lowercase", msg: "are the outliers playing?" },
  { id: "NAM-02", label: "what about outliers", msg: "what about the outliers?" },
  { id: "NAM-03", label: "outliers this year", msg: "are the outliers playing this year?" },
  { id: "NAM-04", label: "hot sauce lowercase", msg: "what about hot sauce?" },
  { id: "NAM-05", label: "neil helgeson lowercase", msg: "is neil helgeson coming back?" },
  { id: "NAM-06", label: "grateful allman", msg: "is grateful allman band experience playing?" },
  { id: "NAM-07", label: "rachel jayne", msg: "is rachel jayne coming up?" },

  // -- No-match / edge cases --
  { id: "EDG-01", label: "taylor swift", msg: "is taylor swift playing there?" },
  { id: "EDG-02", label: "metal shows", msg: "do you have metal shows?" },
  { id: "EDG-03", label: "comedy nights", msg: "any comedy nights?" },
  { id: "EDG-04", label: "easter event", msg: "what about an easter event?" },
];

async function getSession() {
  const url = `${BASE_URL}/api/chat?businessSlug=${BUSINESS_SLUG}&locationSlug=${LOCATION_SLUG}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GET /api/chat failed ${r.status}: ${body}`);
  }
  const data = await r.json();
  // Extract session cookie
  const setCookie = r.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.split(";")[0] || "";
  return { sessionId: data.sessionId, cookie: sessionCookie };
}

async function sendMessage(msg, cookie) {
  const body = {
    businessSlug: BUSINESS_SLUG,
    locationSlug: LOCATION_SLUG,
    messages: [{ role: "user", content: msg }],
  };
  const r = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    return `[ERROR ${r.status}]: ${text}`;
  }

  // Stream the response
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  full += decoder.decode();
  return full.trim();
}

function grade(id, reply) {
  const r = reply.toLowerCase();

  if (id === "GEN-01" || id === "GEN-02") {
    // Should list events
    if (r.includes("piano serenade") || r.includes("mingo") || r.includes("outliers") || r.includes("paint and sip")) return "PASS";
    if (r.includes("no upcoming events") || r.includes("check the website") || r.includes("call us")) return "FAIL-REDIRECT";
    return "PARTIAL";
  }
  if (id === "GEN-03") {
    // March events: piano serenade (20,21), mingo (19,26), paint and sip (25), wine club (27)
    if (r.includes("piano") || r.includes("mingo") || r.includes("paint") || r.includes("wine club")) return "PASS";
    return "FAIL";
  }
  if (id === "GEN-04") {
    // Should include April and May events
    const hasMarch = r.includes("piano") || r.includes("mingo") || r.includes("march");
    const hasMay = r.includes("outliers") || r.includes("hot sauce") || r.includes("neil") || r.includes("rachel") || r.includes("grateful");
    if (hasMarch && hasMay) return "PASS";
    if (hasMay || hasMarch) return "PARTIAL";
    return "FAIL";
  }
  if (id === "GEN-05") {
    // Weekend from March 16, 2026 = March 20-22 → Piano Serenade
    if (r.includes("piano serenade") || r.includes("march 20") || r.includes("march 21")) return "PASS";
    if (r.includes("no") && r.includes("event")) return "FAIL-NODATA";
    return "PARTIAL";
  }

  if (["CAT-01","CAT-02","CAT-03","CAT-04","CAT-05"].includes(id)) {
    // Should list live music acts
    const liveActs = ["outliers","hot sauce","neil helgeson","rachel jayne","grateful allman","lime green","beach bandits","breath of fresh air","piano serenade","dinner club"];
    const hits = liveActs.filter(a => r.includes(a));
    if (hits.length >= 3) return "PASS";
    if (hits.length >= 1) return "PARTIAL";
    if (r.includes("no") && (r.includes("band") || r.includes("music") || r.includes("perform"))) return "FAIL-NODATA";
    return "FAIL";
  }

  if (id === "NAM-01" || id === "NAM-02" || id === "NAM-03") {
    if (r.includes("outliers") && (r.includes("may 1") || r.includes("may 1st") || r.includes("may"))) return "PASS";
    if (r.includes("outliers")) return "PARTIAL";
    if (r.includes("not") && r.includes("schedule")) return "FAIL-NOTFOUND";
    if (r.includes("check the website") || r.includes("call us")) return "FAIL-REDIRECT";
    return "FAIL";
  }
  if (id === "NAM-04") {
    if (r.includes("hot sauce") && (r.includes("may 15") || r.includes("may"))) return "PASS";
    if (r.includes("hot sauce")) return "PARTIAL";
    return "FAIL";
  }
  if (id === "NAM-05") {
    if (r.includes("neil helgeson") && r.includes("may")) return "PASS";
    if (r.includes("neil")) return "PARTIAL";
    return "FAIL";
  }
  if (id === "NAM-06") {
    if (r.includes("grateful allman") && r.includes("may")) return "PASS";
    if (r.includes("grateful")) return "PARTIAL";
    return "FAIL";
  }
  if (id === "NAM-07") {
    if (r.includes("rachel jayne") && r.includes("may")) return "PASS";
    if (r.includes("rachel")) return "PARTIAL";
    return "FAIL";
  }

  if (id === "EDG-01") {
    // Should NOT hallucinate Taylor Swift, should say not scheduled
    if (r.includes("taylor swift") && (r.includes("not") || r.includes("no"))) return "PASS";
    if (r.includes("taylor swift") && !r.includes("not") && !r.includes("no")) return "FAIL-HALLUCINATE";
    return "PASS"; // Simply saying they don't have that is fine
  }
  if (id === "EDG-02" || id === "EDG-03") {
    // Should NOT claim they have metal/comedy, should offer alternatives
    if (r.includes("no") || r.includes("don't") || r.includes("didn't find")) return "PASS";
    return "PARTIAL";
  }
  if (id === "EDG-04") {
    // Easter events exist! Family Style Easter Dinner + Egg Hunt on April 5
    if (r.includes("easter") && (r.includes("april 5") || r.includes("april") || r.includes("dinner") || r.includes("egg"))) return "PASS";
    if (r.includes("easter")) return "PARTIAL";
    if (r.includes("no") && r.includes("easter")) return "FAIL-MISSED";
    return "FAIL";
  }

  return "UNKNOWN";
}

async function main() {
  console.log("=== TANDEM EVENT CHATBOT TEST MATRIX ===");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Business: ${BUSINESS_SLUG}, Location: ${LOCATION_SLUG}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const results = [];

  for (const { id, label, msg } of PROMPTS) {
    process.stdout.write(`[${id}] "${msg}" ... `);

    // Fresh session per test to avoid conversation bleed
    let cookie = "";
    try {
      const sess = await getSession();
      cookie = sess.cookie;
    } catch (e) {
      console.log(`SESSION ERROR: ${e.message}`);
      results.push({ id, label, msg, reply: "SESSION_ERROR", grade: "ERROR" });
      continue;
    }

    try {
      const reply = await sendMessage(msg, cookie);
      const g = grade(id, reply);
      console.log(`${g}`);
      results.push({ id, label, msg, reply, grade: g });
    } catch (e) {
      console.log(`REQUEST ERROR: ${e.message}`);
      results.push({ id, label, msg, reply: `REQUEST_ERROR: ${e.message}`, grade: "ERROR" });
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\n=== RESULTS SUMMARY ===");
  let pass = 0, partial = 0, fail = 0, error = 0;
  for (const r of results) {
    const g = r.grade;
    if (g === "PASS") pass++;
    else if (g.startsWith("PARTIAL")) partial++;
    else if (g.startsWith("FAIL") || g === "UNKNOWN") fail++;
    else error++;
  }
  console.log(`PASS: ${pass} | PARTIAL: ${partial} | FAIL: ${fail} | ERROR: ${error}`);
  console.log(`Total: ${results.length}\n`);

  console.log("=== DETAILED RESULTS ===");
  for (const r of results) {
    console.log(`\n[${r.id}] ${r.label} → ${r.grade}`);
    console.log(`Q: ${r.msg}`);
    const preview = r.reply.replace(/\n+/g, " ").slice(0, 250);
    console.log(`A: ${preview}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
