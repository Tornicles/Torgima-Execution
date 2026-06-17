#!/usr/bin/env node
/**
 * Post-deploy connection validation chain.
 * Probes canonical production API (api.torgima.com) first; workers.dev is optional fallback.
 *
 * Usage:
 *   pnpm run verify:deploy:connections
 *   pnpm run verify:deploy:connections -- --soft
 */
import {
  CANONICAL_API_BASE,
  PROBE_USER_AGENT,
  resolveWorkersDevUrl,
} from "./production-probe-common.mjs";

const softFlag = process.argv.includes("--soft");
const API_BASE = (
  process.env.VITE_API_BASE_URL?.trim() ||
  process.env.TORGIMA_API_BASE_URL?.trim() ||
  CANONICAL_API_BASE
).replace(/\/$/, "");
const WORKERS_DEV = resolveWorkersDevUrl();

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

async function fetchJson(base, path, options = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": PROBE_USER_AGENT,
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
  return { res, body, text, url };
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

async function probeHealthOnBase(base, label) {
  await check(`${label} /health`, async () => {
    const { res, body } = await fetchJson(base, "/health");
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (typeof body === "object" && body.ok !== true) throw new Error("ok !== true");
  });
}

async function main() {
  log(`Canonical API: ${API_BASE}`);
  log(`Optional workers.dev: ${WORKERS_DEV}`);
  log("══════════════════════════════════");
  log(" CONNECTION VALIDATION CHAIN");
  log("══════════════════════════════════");

  await probeHealthOnBase(API_BASE, "Canonical API");

  let workersDevOk = false;
  try {
    await probeHealthOnBase(WORKERS_DEV, "workers.dev (optional)");
    workersDevOk = true;
  } catch {
    log("NOTE  workers.dev health unavailable — OPTIONAL_WORKERS_DEV_DEBUG_ROUTE_NOT_FOUND");
  }

  await check("Canonical /api/health", async () => {
    const { res, body } = await fetchJson(API_BASE, "/api/health");
    if (res.status !== 200 && res.status !== 503) throw new Error(`HTTP ${res.status}`);
    if (typeof body !== "object" || body === null) throw new Error("non-JSON body");
    if (body.checks) {
      log(`  status=${body.status} checks=${Object.keys(body.checks).length}`);
    } else if (body.ok === true) {
      log(`  status=${body.status ?? "operational"} (db-free liveness)`);
    } else {
      throw new Error("unexpected /api/health body");
    }
  });

  await check("Auth /api/auth/session", async () => {
    const { res } = await fetchJson(API_BASE, "/api/auth/session");
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });

  await check("CORS for torgima.com", async () => {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Origin: "https://torgima.com", "User-Agent": PROBE_USER_AGENT },
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
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": PROBE_USER_AGENT,
        },
        body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
      });
      if (res.status === 404) throw new Error("404 Not Found");
      if (res.status === 0) throw new Error("no response");
      log(`  HTTP ${res.status}`);
    });
  }

  if (!workersDevOk) {
    log("workers.dev optional probes skipped (canonical API passed)");
  }

  log("");
  log("══════════════════════════════════");
  log(" CONNECTION CHAIN COMPLETE");
  log("══════════════════════════════════");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
