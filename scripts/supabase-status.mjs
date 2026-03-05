import { spawnSync } from "node:child_process";

function run(command, args, label) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    console.error(`[db:status] ${label} failed`);
    process.exit(result.status);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[db:status] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const dbUrl = process.env.DATABASE_URL?.trim();

if (dbUrl) {
  run("npx", ["--yes", "supabase", "migration", "list", "--db-url", dbUrl], "supabase migration list (db-url)");
  process.exit(0);
}

requireEnv("SUPABASE_PROJECT_REF");
requireEnv("SUPABASE_ACCESS_TOKEN");
requireEnv("SUPABASE_DB_PASSWORD");

run("node", ["./scripts/supabase-link.mjs"], "supabase link");
run("npx", ["--yes", "supabase", "migration", "list"], "supabase migration list");
