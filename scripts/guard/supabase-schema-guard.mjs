import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REQUIRED_TABLES = [
  "businesses",
  "business_locations",
  "business_location_configs",
  "business_memberships",
  "chat_sessions",
  "chat_messages",
  "onboarding_import_runs",
  "operator_profiles",
];

const REQUIRED_FUNCTIONS = [
  "bootstrap_membership",
  "create_business_location",
];

const REQUIRED_INDEXES = [
  "idx_business_memberships_user_id",
  "idx_businesses_slug",
  "idx_business_locations_business_created",
  "idx_chat_sessions_business_location_updated",
  "chat_messages_session_id_created_at_idx",
];

const REQUIRED_RLS_TABLES = [
  "businesses",
  "business_locations",
  "business_location_configs",
  "business_memberships",
  "chat_sessions",
  "chat_messages",
  "onboarding_import_runs",
  "operator_profiles",
];

const REQUIRED_POLICY_TABLES = [
  "businesses",
  "business_locations",
  "business_location_configs",
  "business_memberships",
  "chat_sessions",
  "chat_messages",
];

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });

  if (typeof result.status === "number" && result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    console.error(`[guard:schema] ${label} failed`);
    if (stderr) {
      console.error(stderr);
    } else if (stdout) {
      console.error(stdout);
    }
    process.exit(result.status);
  }
}

function maybeLinkProject() {
  const hasLinkEnv =
    Boolean(process.env.SUPABASE_PROJECT_REF?.trim()) &&
    Boolean(process.env.SUPABASE_DB_PASSWORD?.trim()) &&
    Boolean(process.env.SUPABASE_ACCESS_TOKEN?.trim());

  if (!hasLinkEnv) {
    return;
  }

  run("node", ["./scripts/supabase-link.mjs"], "supabase link");
}

function extractSet(content, pattern) {
  const matches = content.matchAll(pattern);
  return new Set(Array.from(matches, (match) => match[1]));
}

function listMissing(required, existingSet) {
  return required.filter((entry) => !existingSet.has(entry));
}

function printMissing(title, values) {
  console.error(`${title}:`);
  if (!values.length) {
    console.error("- (none)");
    return;
  }
  values.forEach((value) => console.error(`- ${value}`));
}

function main() {
  maybeLinkProject();

  const tempDir = mkdtempSync(join(tmpdir(), "tandem-schema-guard-"));
  const dumpPath = join(tempDir, "public-schema.sql");

  try {
    run(
      "npx",
      ["--yes", "supabase", "db", "dump", "--linked", "--schema", "public", "--file", dumpPath],
      "supabase db dump",
    );

    const dumpSql = readFileSync(dumpPath, "utf8");

    // Equivalent object checks for information_schema.tables/information_schema.routines/pg_indexes.
    const existingTables = extractSet(
      dumpSql,
      /CREATE TABLE IF NOT EXISTS "public"\."([^"]+)"/g,
    );
    const existingFunctions = extractSet(
      dumpSql,
      /CREATE OR REPLACE FUNCTION "public"\."([^"]+)"/g,
    );
    const existingIndexes = extractSet(
      dumpSql,
      /CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "public"\./g,
    );
    const tablesWithRls = extractSet(
      dumpSql,
      /ALTER TABLE "public"\."([^"]+)" ENABLE ROW LEVEL SECURITY;/g,
    );
    const tablesWithPolicies = extractSet(
      dumpSql,
      /CREATE POLICY "[^"]+" ON "public"\."([^"]+)"/g,
    );

    const missingTables = listMissing(REQUIRED_TABLES, existingTables);
    const missingFunctions = listMissing(REQUIRED_FUNCTIONS, existingFunctions);
    const missingIndexes = listMissing(REQUIRED_INDEXES, existingIndexes);
    const missingRlsTables = listMissing(REQUIRED_RLS_TABLES, tablesWithRls);
    const missingPolicyTables = listMissing(REQUIRED_POLICY_TABLES, tablesWithPolicies);

    if (
      missingTables.length ||
      missingFunctions.length ||
      missingIndexes.length ||
      missingRlsTables.length ||
      missingPolicyTables.length
    ) {
      console.error("❌ Supabase schema guard failed\n");
      printMissing("Missing tables", missingTables);
      console.error("");
      printMissing("Missing functions", missingFunctions);
      console.error("");
      printMissing("Missing indexes", missingIndexes);
      console.error("");
      printMissing("Missing RLS on tables", missingRlsTables);
      console.error("");
      printMissing("Missing RLS policies on tables", missingPolicyTables);
      process.exit(1);
    }

    console.log("✅ Supabase schema + RLS verified");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
