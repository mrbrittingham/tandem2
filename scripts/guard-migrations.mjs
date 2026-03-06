import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const AUTHORITATIVE_DIR = path.join(repoRoot, "supabase", "migrations");
const HISTORICAL_DIR = path.join(repoRoot, "packages", "shared", "supabase", "migrations");

const ALLOWED_HISTORICAL_FILES = new Set([
  "0001_init.sql",
  "0002_auth_rls.sql",
  "0003_fix_bootstrap_membership_ambiguity.sql",
  "0004_locations.sql",
  "0005_chat_session_location_scope.sql",
]);

const BASELINE_FILE = "20260302022759_remote_schema.sql";
const REQUIRED_BASELINE_TABLES = [
  "businesses",
  "business_memberships",
  "chat_sessions",
  "chat_messages",
  "business_locations",
  "business_location_configs",
];

function extractCreatedTables(sql) {
  const matches = sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi);
  return new Set(Array.from(matches, (match) => match[1].toLowerCase()));
}

function extractAlteredTables(sql) {
  const matches = sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)/gi);
  return Array.from(matches, (match) => match[1].toLowerCase());
}

function listSqlFiles(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath)
    .filter((entry) => entry.toLowerCase().endsWith(".sql"))
    .filter((entry) => statSync(path.join(dirPath, entry)).isFile())
    .sort();
}

function fail(message) {
  console.error(`\n[migration-guard] ${message}\n`);
  process.exit(1);
}

if (!existsSync(AUTHORITATIVE_DIR)) {
  fail("Authoritative migrations folder missing: supabase/migrations");
}

const authoritativeFiles = listSqlFiles(AUTHORITATIVE_DIR);
if (authoritativeFiles.length === 0) {
  fail("No SQL migrations found in supabase/migrations");
}

const emptyAuthoritative = authoritativeFiles.filter((fileName) => {
  const filePath = path.join(AUTHORITATIVE_DIR, fileName);
  const content = readFileSync(filePath, "utf8");
  return content.trim().length === 0;
});

if (emptyAuthoritative.length > 0) {
  fail(
    [
      "Found empty migration files under supabase/migrations:",
      ...emptyAuthoritative.map((entry) => `- ${entry}`),
      "Each authoritative migration file must contain SQL statements.",
    ].join("\n"),
  );
}

if (!authoritativeFiles.includes(BASELINE_FILE)) {
  fail(`Required baseline migration is missing: ${BASELINE_FILE}`);
}

const baselinePath = path.join(AUTHORITATIVE_DIR, BASELINE_FILE);
const baselineSql = readFileSync(baselinePath, "utf8");
const baselineTables = extractCreatedTables(baselineSql);
const missingBaselineTables = REQUIRED_BASELINE_TABLES.filter((table) => !baselineTables.has(table));

if (missingBaselineTables.length > 0) {
  fail(
    [
      `Baseline migration ${BASELINE_FILE} is missing required core tables:`,
      ...missingBaselineTables.map((entry) => `- public.${entry}`),
      "These tables are required by later authoritative migrations and runtime API flows.",
    ].join("\n"),
  );
}

const createdTablesByFile = new Map();
for (const fileName of authoritativeFiles) {
  const sql = readFileSync(path.join(AUTHORITATIVE_DIR, fileName), "utf8");
  createdTablesByFile.set(fileName, extractCreatedTables(sql));
}

const knownTables = new Set();
for (const fileName of authoritativeFiles) {
  const sql = readFileSync(path.join(AUTHORITATIVE_DIR, fileName), "utf8");
  for (const alteredTable of extractAlteredTables(sql)) {
    if (!knownTables.has(alteredTable) && !createdTablesByFile.get(fileName)?.has(alteredTable)) {
      fail(
        [
          `Migration ${fileName} alters table public.${alteredTable} before it is created in authoritative migrations.`,
          "Ensure the baseline (or an earlier migration) creates this table first.",
        ].join("\n"),
      );
    }
  }

  for (const createdTable of createdTablesByFile.get(fileName) ?? []) {
    knownTables.add(createdTable);
  }
}

const historicalFiles = listSqlFiles(HISTORICAL_DIR);
const unexpectedHistorical = historicalFiles.filter((fileName) => !ALLOWED_HISTORICAL_FILES.has(fileName));

if (unexpectedHistorical.length > 0) {
  fail(
    [
      "Found non-authoritative migration files under packages/shared/supabase/migrations:",
      ...unexpectedHistorical.map((entry) => `- ${entry}`),
      "Only supabase/migrations/* is allowed for new production migrations.",
    ].join("\n"),
  );
}

console.log("[migration-guard] OK: authoritative migrations passed structure and dependency checks.");