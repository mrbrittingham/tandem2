import { spawnSync } from "node:child_process";

const name = process.argv[2]?.trim();
if (!name) {
  console.error("[migration:new] Usage: npm run migration:new -- <name>");
  process.exit(1);
}

const result = spawnSync("npx", ["--yes", "supabase", "migration", "new", name], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

if (typeof result.status === "number" && result.status !== 0) {
  console.error("[migration:new] supabase migration new failed");
  process.exit(result.status);
}
