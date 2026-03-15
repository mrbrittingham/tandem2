import { spawnSync } from "node:child_process";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[db:pull] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    console.error(`[db:pull] ${label} failed`);
    process.exit(result.status);
  }
}

const dbUrl = process.env.DATABASE_URL?.trim();
const migrationNameArg = process.argv[2]?.trim();
const pullArgs = ["--yes", "supabase", "db", "pull"];

if (migrationNameArg) {
  pullArgs.push(migrationNameArg);
}

pullArgs.push("--schema", "public");

if (dbUrl) {
  run("npx", [...pullArgs, "--db-url", dbUrl], "supabase db pull (db-url)");
  process.exit(0);
}

requireEnv("SUPABASE_PROJECT_REF");
requireEnv("SUPABASE_ACCESS_TOKEN");
requireEnv("SUPABASE_DB_PASSWORD");

run("node", ["./scripts/supabase-link.mjs"], "supabase link");
run("npx", pullArgs, "supabase db pull");
