#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

function run(command) {
  return execSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function safeRun(command) {
  try {
    return { ok: true, output: run(command) };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

function getMigrationFilename(versionPrefix, files) {
  return files.find((file) => file.startsWith(versionPrefix)) ?? null;
}

function getLocalPendingMigrations(files) {
  const result = safeRun("npx --yes supabase migration list");
  if (!result.ok) {
    return {
      known: false,
      pending: files,
      reason: "Could not read Supabase migration status. Showing all migration files for manual verification.",
    };
  }

  const lines = result.output.split(/\r?\n/);
  const tableLines = lines.filter(
    (line) => line.includes("|") && !line.includes("Local") && !line.includes("---"),
  );

  const pending = [];
  for (const line of tableLines) {
    const [localRaw, remoteRaw] = line.split("|").map((part) => part.trim());
    if (!remoteRaw) {
      continue;
    }
    if (!localRaw && remoteRaw) {
      const filename = getMigrationFilename(remoteRaw, files);
      pending.push(filename ?? `${remoteRaw} (filename not found under supabase/migrations)`);
    }
  }

  return {
    known: true,
    pending,
    reason: "Derived from `supabase migration list` (remote present, local missing).",
  };
}

function main() {
  const branch = run("git branch --show-current");
  const commit = run("git rev-parse --short HEAD");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const pendingInfo = getLocalPendingMigrations(migrationFiles);

  console.log("Deploy Environment Doctor");
  console.log("=========================");
  console.log(`Current branch: ${branch}`);
  console.log(`Last commit: ${commit}`);
  console.log("");
  console.log("Branch contract reminder:");
  console.log("- Production branch: main");
  console.log("- Development/Staging branch: wip/desktop-sync");
  console.log("");
  console.log("Supabase migrations not yet applied locally:");
  if (pendingInfo.pending.length === 0) {
    console.log("- none detected");
  } else {
    for (const file of pendingInfo.pending) {
      console.log(`- ${file}`);
    }
  }
  console.log("");
  console.log(`Status source: ${pendingInfo.reason}`);
}

main();
