#!/usr/bin/env node
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

const targets = [
  "apps/chatbot/.next",
  "apps/chatbot/tsconfig.tsbuildinfo",
  "packages/shared/tsconfig.tsbuildinfo",
  "packages/ui-kit/tsconfig.tsbuildinfo",
];

let removed = 0;

for (const target of targets) {
  const absolute = join(projectRoot, target);
  if (existsSync(absolute)) {
    rmSync(absolute, { recursive: true, force: true });
    removed += 1;
    console.log(`Removed ${target}`);
  }
}

if (removed === 0) {
  console.log("Nothing to clean; all generated artifacts already removed.");
} else {
  console.log(`Cleaned ${removed} artifact${removed === 1 ? "" : "s"}.`);
}
