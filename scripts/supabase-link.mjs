import { spawnSync } from "node:child_process";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[db:link] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const projectRef = requireEnv("SUPABASE_PROJECT_REF");
const dbPassword = requireEnv("SUPABASE_DB_PASSWORD");
requireEnv("SUPABASE_ACCESS_TOKEN");

const link = spawnSync(
  "npx",
  ["--yes", "supabase", "link", "--project-ref", projectRef, "--password", dbPassword],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  },
);

if (typeof link.status === "number" && link.status !== 0) {
  process.exit(link.status);
}

process.exit(0);
