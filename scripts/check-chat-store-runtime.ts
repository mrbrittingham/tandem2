#!/usr/bin/env node

import path from "node:path";
import { resolveChatStoreDataDir, resolveChatStoreSelection } from "../packages/shared/src/storage";

function fail(message: string): never {
  console.error(`[check:chat-store] FAIL: ${message}`);
  process.exit(1);
}

function info(message: string) {
  console.log(`[check:chat-store] ${message}`);
}

function isPathInsideCwd(dir: string) {
  const relative = path.relative(process.cwd(), dir);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL === "1" || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function hasSupabaseServerEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function main() {
  const selection = resolveChatStoreSelection();
  const isProd = process.env.NODE_ENV === "production";
  const isServerless = isServerlessRuntime();

  info(`selection=${selection.backend}`);

  if (selection.backend === "supabase") {
    if (!hasSupabaseServerEnv()) {
      fail("Supabase backend selected but required server env vars are missing.");
    }
    info("PASS using Supabase-backed chat store");
    return;
  }

  const dataDir = resolveChatStoreDataDir();
  info(`dataDir=${dataDir}`);

  if ((isProd || isServerless) && isPathInsideCwd(dataDir)) {
    fail(`File chat store path must not live under repository cwd in production/serverless. Got ${dataDir}`);
  }

  if (isServerless && !dataDir.startsWith("/tmp/")) {
    fail(`Serverless file chat store path must be under /tmp. Got ${dataDir}`);
  }

  info("PASS file-backed chat store path is runtime-safe");
}

main();
