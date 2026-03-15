import { spawnSync } from "node:child_process";

function run(command, args, label) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    console.error(`[db:push] ${label} failed`);
    process.exit(result.status);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[db:push] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const dbUrl = process.env.DATABASE_URL?.trim();

if (dbUrl) {
  run("npx", ["--yes", "supabase", "db", "push", "--db-url", dbUrl, "--yes"], "supabase db push (db-url)");
  process.exit(0);
}

const dbPassword = requireEnv("SUPABASE_DB_PASSWORD");
requireEnv("SUPABASE_PROJECT_REF");
requireEnv("SUPABASE_ACCESS_TOKEN");

run("node", ["./scripts/supabase-link.mjs"], "supabase link");
run("npx", ["--yes", "supabase", "db", "push", "--password", dbPassword, "--yes"], "supabase db push");
