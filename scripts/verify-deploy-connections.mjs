#!/usr/bin/env node
/**
 * Post-deploy connection validation chain.
 * Uses workers.dev URL to bypass zone WAF.
 *
 * Usage:
 *   pnpm run verify:deploy:connections
 *   pnpm run verify:deploy:connections -- --soft
 */

const softFlag = process.argv.includes("--soft");
const DEFAULT_WORKER_URL = "https://torgima.tmagaya.workers.dev";

/** GHA unset vars are empty strings — ?? does not fall back for those. */
function resolveWorkerUrl(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return (trimmed || DEFAULT_WORKER_URL).replace(/\/$/, "");
}

const WORKER = resolveWorkerUrl(process.env.WORKER_URL);
const UA = "GitHub-Actions-Deploy-Verify/1.0";

function log(msg) {
  console.log(`[connections] ${msg}`);
}

function fail(msg) {
  if (softFlag) {
    console.warn(`[connections] ${msg} — continuing (--soft)`);
    return false;
  }
  console.error(`[connections] ${msg}`);
  process.exit(1);
}

async function fetchJson(path, options = {}) {
  const url = `${WORKER}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": UA,
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function check(name, fn) {
  try {
    await fn();
    log(`PASS ✓ ${name}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FAIL ✗ ${name}: ${msg}`);
    if (!softFlag) process.exit(1);
    return false;
  }
}

async function main() {
  log(`Worker base: ${WORKER}`);
  log("══════════════════════════════════");
  log(" CONNECTION VALIDATION CHAIN");
  log("══════════════════════════════════");

  await check("Worker /health", async () => {
    const { res, body } = await fetchJson("/health");
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (typeof body === "object" && body.ok !== true) throw new Error("ok !== true");
  });

  await check("Worker /api/health", async () => {
    const { res, body } = await fetchJson("/api/health");
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (typeof body !== "object" || !body.checks) {
      throw new Error("missing checks object");
    }
    log(`  status=${body.status} checks=${Object.keys(body.checks).length}`);
  });

  await check("Auth /api/auth/session", async () => {
    const { res } = await fetchJson("/api/auth/session");
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });

  await check("CORS for torgima.com", async () => {
    const res = await fetch(`${WORKER}/health`, {
      headers: { Origin: "https://torgima.com", "User-Agent": UA },
    });
    const acao = res.headers.get("access-control-allow-origin");
    if (!acao) throw new Error("no Access-Control-Allow-Origin header");
    log(`  Access-Control-Allow-Origin: ${acao}`);
  });

  const endpoints = [
    ["POST /api/auth/send-magic-link", "POST", "/api/auth/send-magic-link", { email: "deploy-test@torgima.com" }],
    ["GET /api/onboarding/status", "GET", "/api/onboarding/status"],
    ["POST /api/v1/validation/run", "POST", "/api/v1/validation/run", {}],
    ["GET /api/state/dashboard", "GET", "/api/state/dashboard"],
  ];

  for (const [label, method, path, payload] of endpoints) {
    await check(`Route exists: ${label}`, async () => {
      const res = await fetch(`${WORKER}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": UA,
        },
        body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
      });
      if (res.status === 404) throw new Error("404 Not Found");
      if (res.status === 0) throw new Error("no response");
      log(`  HTTP ${res.status}`);
    });
  }

  log("");
  log("══════════════════════════════════");
  log(" CONNECTION CHAIN COMPLETE");
  log("══════════════════════════════════");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});