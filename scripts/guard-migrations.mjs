import { existsSync, readdirSync, statSync } from "node:fs";
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

console.log("[migration-guard] OK: supabase/migrations is authoritative and no new historical migration files were detected.");