#!/usr/bin/env node

import { spawn } from "node:child_process";

const BASE_URL = process.env.BASE_URL?.trim() || "http://localhost:3100";
const WAIT_TIMEOUT_MS = Number(process.env.SMOKE_WAIT_TIMEOUT_MS ?? 120_000);
const POLL_INTERVAL_MS = 1_500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  const healthUrl = `${BASE_URL}/api/health`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for ${healthUrl}`);
}

function shutdown(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
    child.kill("SIGTERM");

    setTimeout(() => {
      if (child.exitCode === null && !child.signalCode) {
        child.kill("SIGKILL");
      }
    }, 8_000);
  });
}

async function main() {
  const dev = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DEV_SMOKE: process.env.DEV_SMOKE?.trim() || "1",
    },
  });

  try {
    await waitForHealth();

    const smoke = spawn("npm", ["run", "smoke:chat"], {
      stdio: "inherit",
      env: {
        ...process.env,
        DEV_SMOKE: process.env.DEV_SMOKE?.trim() || "1",
      },
    });

    const code = await new Promise((resolve) => {
      smoke.once("exit", (exitCode) => resolve(exitCode ?? 1));
    });

    if (code !== 0) {
      process.exit(code);
    }
  } finally {
    await shutdown(dev);
  }
}

main().catch((error) => {
  console.error(`[smoke:chat:dev] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
