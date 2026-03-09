/**
 * Documentation generator for the Tandem monorepo.
 *
 * Scans repository directories and updates auto-generated sections
 * in docs/repo-map.md. Manual sections and files in docs/product/
 * are never overwritten.
 *
 * Usage: npx tsx scripts/generate-docs.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const REPO_MAP = path.join(ROOT, "docs", "repo-map.md");
const SYSTEM_ARCH = path.join(ROOT, "docs", "system-architecture.md");

// ── Helpers ──────────────────────────────────────────────

function listSubdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

function hasPackageJson(dir: string): boolean {
  return fs.existsSync(path.join(dir, "package.json"));
}

function readPackageName(dir: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf-8")
    );
    return pkg.name || path.basename(dir);
  } catch {
    return path.basename(dir);
  }
}

// ── Scanners ─────────────────────────────────────────────

function scanApps(): { name: string; dir: string }[] {
  const appsDir = path.join(ROOT, "apps");
  return listSubdirs(appsDir)
    .filter((d) => hasPackageJson(path.join(appsDir, d)))
    .map((d) => ({
      name: readPackageName(path.join(appsDir, d)),
      dir: `apps/${d}`,
    }));
}

function scanPackages(): { name: string; dir: string }[] {
  const pkgsDir = path.join(ROOT, "packages");
  return listSubdirs(pkgsDir)
    .filter((d) => hasPackageJson(path.join(pkgsDir, d)))
    .map((d) => ({
      name: readPackageName(path.join(pkgsDir, d)),
      dir: `packages/${d}`,
    }));
}

function scanApiRoutes(): string[] {
  const apiDir = path.join(ROOT, "apps", "dashboard", "src", "app", "api");
  if (!fs.existsSync(apiDir)) return [];

  const routes: string[] = [];

  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, `${prefix}/${entry.name}`);
      } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
        routes.push(prefix);
      }
    }
  }

  walk(apiDir, "/api");
  return routes.sort();
}

function scanConsolePages(): string[] {
  const consoleDir = path.join(
    ROOT,
    "apps",
    "dashboard",
    "src",
    "app",
    "(console)"
  );
  if (!fs.existsSync(consoleDir)) return [];

  const pages: string[] = [];

  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
        pages.push(prefix || "/");
      }
    }
  }

  walk(consoleDir, "");
  return pages.sort();
}

function scanMigrations(): string[] {
  const migDir = path.join(ROOT, "supabase", "migrations");
  return listFiles(migDir).filter((f) => f.endsWith(".sql"));
}

function scanUiKitCategories(): string[] {
  const uiSrc = path.join(ROOT, "packages", "ui-kit", "src");
  return listSubdirs(uiSrc);
}

// ── Section Generators ───────────────────────────────────

function generateArchitectureOverview(
  apps: { name: string; dir: string }[],
  pkgs: { name: string; dir: string }[]
): string {
  const lines: string[] = [];
  lines.push("## Architecture Overview");
  lines.push("");
  lines.push(
    "Tandem is an npm workspaces monorepo for a restaurant-focused operator platform. It consists of one Next.js app, two shared packages, async workers, and Supabase-backed persistence."
  );
  lines.push("");
  lines.push("| Layer | Location | Purpose |");
  lines.push("|-------|----------|---------|");

  for (const app of apps) {
    lines.push(`| App | \`${app.dir}\` | ${app.name} |`);
  }
  for (const pkg of pkgs) {
    lines.push(`| Package | \`${pkg.dir}\` | ${pkg.name} |`);
  }

  lines.push(
    "| Worker | `scripts/worker/` | Async website-import processor |"
  );
  lines.push(
    "| Database | `supabase/migrations/` | Supabase schema (authoritative migration path) |"
  );
  lines.push(
    "| Scripts | `scripts/` | CLI helpers for dev, deploy, migration, smoke tests |"
  );

  return lines.join("\n");
}

function generateDirectoryMap(
  apps: { name: string; dir: string }[],
  pkgs: { name: string; dir: string }[],
  uiCategories: string[]
): string {
  const lines: string[] = [];
  lines.push("## Major Directories");
  lines.push("");
  lines.push("```");
  lines.push("tandem/");
  lines.push("├── apps/");

  for (const app of apps) {
    lines.push(`│   └── ${path.basename(app.dir)}/`);
  }

  lines.push("├── packages/");
  for (const pkg of pkgs) {
    const base = path.basename(pkg.dir);
    lines.push(`│   ├── ${base}/`);

    if (base === "ui-kit" && uiCategories.length > 0) {
      lines.push(`│   │   └── src/`);
      for (const cat of uiCategories) {
        lines.push(`│   │       ├── ${cat}/`);
      }
    }
  }

  lines.push("├── scripts/");
  lines.push("│   ├── worker/");
  lines.push("│   └── guard/");
  lines.push("├── supabase/");
  lines.push("│   └── migrations/");
  lines.push("├── docs/");
  lines.push("│   └── product/                (manually maintained)");
  lines.push("└── .github/");
  lines.push("```");

  return lines.join("\n");
}

// ── Section Replacement ──────────────────────────────────

const SECTION_START_RE =
  /^<!-- AUTO-GENERATED SECTION: (\S+) -->\s*$/;
const SECTION_END_RE =
  /^<!-- END AUTO-GENERATED SECTION: (\S+) -->\s*$/;

function replaceSections(
  content: string,
  sections: Record<string, string>
): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let currentSection: string | null = null;
  let skipLine = false;

  for (const line of lines) {
    const startMatch = line.match(SECTION_START_RE);
    const endMatch = line.match(SECTION_END_RE);

    if (startMatch) {
      const sectionName = startMatch[1];
      output.push(line);
      if (sectionName in sections) {
        currentSection = sectionName;
        output.push("");
        output.push(sections[sectionName]);
        output.push("");
        skipLine = true;
      }
      continue;
    }

    if (endMatch) {
      const sectionName = endMatch[1];
      if (currentSection === sectionName) {
        currentSection = null;
        skipLine = false;
      }
      output.push(line);
      continue;
    }

    if (!skipLine) {
      output.push(line);
    }
  }

  return output.join("\n");
}

// ── Main ─────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning repository...");

  const apps = scanApps();
  const pkgs = scanPackages();
  const apiRoutes = scanApiRoutes();
  const consolePages = scanConsolePages();
  const migrations = scanMigrations();
  const uiCategories = scanUiKitCategories();

  console.log(`   Apps: ${apps.map((a) => a.name).join(", ")}`);
  console.log(`   Packages: ${pkgs.map((p) => p.name).join(", ")}`);
  console.log(`   API routes: ${apiRoutes.length}`);
  console.log(`   Console pages: ${consolePages.length}`);
  console.log(`   Migrations: ${migrations.length}`);
  console.log(`   UI Kit categories: ${uiCategories.join(", ")}`);

  // Read current repo-map.md
  if (!fs.existsSync(REPO_MAP)) {
    console.error("❌ docs/repo-map.md not found. Create it first.");
    process.exit(1);
  }

  const content = fs.readFileSync(REPO_MAP, "utf-8");

  // Generate section content
  const sections: Record<string, string> = {
    "architecture-overview": generateArchitectureOverview(apps, pkgs),
    "directory-map": generateDirectoryMap(apps, pkgs, uiCategories),
  };

  // Replace auto-generated sections
  const updated = replaceSections(content, sections);

  if (updated === content) {
    console.log("✅ docs/repo-map.md is already up to date.");
  } else {
    fs.writeFileSync(REPO_MAP, updated, "utf-8");
    console.log("✅ docs/repo-map.md updated.");
  }

  // Ensure system-architecture.md exists (never overwrite)
  if (!fs.existsSync(SYSTEM_ARCH)) {
    const placeholder = [
      "# Tandem System Architecture",
      "",
      "This document explains how the entire Tandem platform works.",
      "",
      "## Sections to complete",
      "",
      "- Platform Overview",
      "- High-Level System Diagram",
      "- Major Subsystems",
      "- Data Flow",
      "- Runtime Components",
      "- Future Architecture Direction",
      "",
      "See `docs/repo-map.md` for repository structure.",
      "",
    ].join("\n");
    fs.writeFileSync(SYSTEM_ARCH, placeholder, "utf-8");
    console.log("📝 docs/system-architecture.md created (placeholder).");
  } else {
    console.log("✅ docs/system-architecture.md already exists.");
  }

  // Summary output
  console.log("\n📊 Repository Summary:");
  console.log(`   ${apps.length} app(s), ${pkgs.length} package(s)`);
  console.log(`   ${apiRoutes.length} API route(s), ${consolePages.length} console page(s)`);
  console.log(`   ${migrations.length} migration(s)`);
}

main();
