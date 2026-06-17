#!/usr/bin/env node
/**
 * Full production verification — probes, Supabase Management API (optional), runtime DB scripts.
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm production:prod:verify
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  CANONICAL_API_BASE,
  FAILURE_CLASSES,
  fetchSupabaseManagementConfig,
  probeDebugRoute,
  probeHealth,
  printProbeResult,
  resolveInternalAuthSecret,
  resolveWorkersDevUrl,
} from "./production-probe-common.mjs";
import { hasVerifyConfirm, loadProductionEnv } from "./db-prod-common.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = join(root, "reports");
const outJson = join(reportsDir, "_production_readiness_input.json");

loadProductionEnv();

if (!hasVerifyConfirm()) {
  console.error("Production verify requires TORGIMA_PROD_CONFIRM=1 or CONFIRM_PRODUCTION_SMOKE=true");
  process.exit(1);
}

const report = {
  generated_at: new Date().toISOString(),
  canonical_api_base: CANONICAL_API_BASE,
  probes: {},
  failure_classes: [],
  production: {},
  blockers: [],
};

function setProbe(key, result) {
  report.probes[key] = {
    ok: Boolean(result.ok),
    warn: Boolean(result.warn),
    status: result.status ?? null,
    class: result.class ?? null,
    detail: result.detail ?? null,
  };
  if (result.class) report.failure_classes.push(result.class);
  printProbeResult(key, result);
}

console.log("TORGIMA Production Verification");
console.log("");

const auth = resolveInternalAuthSecret();
if (!auth.ok) {
  setProbe("internal_auth", { ok: false, class: auth.class });
  report.blockers.push("Missing INTERNAL_AUTH_SECRET");
} else {
  setProbe("internal_auth", { ok: true, class: "PASS" });
}

const health = await probeHealth(CANONICAL_API_BASE);
setProbe("canonical_api_health", health);

let canonicalDebugOk = false;
if (auth.ok) {
  const dbTarget = await probeDebugRoute(
    CANONICAL_API_BASE,
    "/api/debug/db-target",
    auth.secret,
  );
  setProbe("worker_database_target_debug", {
    ...dbTarget,
    class: dbTarget.ok
      ? FAILURE_CLASSES.CANONICAL_DEBUG_DB_TARGET_PASS
      : dbTarget.class,
  });

  const bhudhi = await probeDebugRoute(
    CANONICAL_API_BASE,
    "/api/debug/bhudhi-runtime",
    auth.secret,
  );
  setProbe("worker_bhudhi_debug", {
    ...bhudhi,
    class: bhudhi.ok ? FAILURE_CLASSES.CANONICAL_DEBUG_BHUDHI_PASS : bhudhi.class,
  });

  canonicalDebugOk = dbTarget.ok;

  const workersDev = resolveWorkersDevUrl();
  const workersDb = await probeDebugRoute(workersDev, "/api/debug/db-target", auth.secret);
  const workersClass =
    workersDb.status === 404 || workersDb.class === FAILURE_CLASSES.DEBUG_ROUTE_NOT_DEPLOYED
      ? FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL
      : workersDb.ok
        ? FAILURE_CLASSES.WORKERS_DEV_DEBUG_PASS
        : workersDb.class;
  setProbe("workers_dev_debug_db_target", {
    ...workersDb,
    warn: workersClass === FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL,
    class: workersClass,
  });
}

console.log("");
const supabaseMgmt = await fetchSupabaseManagementConfig();
setProbe("supabase_management_api_config", supabaseMgmt);
report.production.supabase_management_api_config = {
  status: supabaseMgmt.ok === true ? "PASS" : supabaseMgmt.warn ? "WARN_TIMEOUT" : supabaseMgmt.ok === null ? "SKIPPED" : "FAIL",
  class: supabaseMgmt.class,
};

function runScript(label, scriptPath, extraEnv = {}) {
  console.log(`\n--- ${label} ---`);
  const result = spawnSync(process.execPath, [join(root, scriptPath)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  const ok = (result.status ?? 1) === 0;
  report.production[label] = { status: ok ? "PASS" : "FAIL" };
  return ok;
}

console.log("");
let runtimeDbOk = false;
if (process.env.DATABASE_URL?.trim() || process.env.TORGIMA_PRODUCTION_DATABASE_URL?.trim()) {
  runtimeDbOk = runScript("runtime_database_connection", "scripts/db-prod-verify-runtime.mjs");
} else {
  console.log("SKIP  runtime_database_connection — DATABASE_URL not in environment");
  report.production.runtime_database_connection = { status: "SKIPPED", note: "no DATABASE_URL" };
}

const eventsOk = runScript("events_production_verification", "scripts/events-prod-verify.mjs");
const bhudhiOk = runScript("bhudhi_production_verification", "scripts/bhudhi-prod-verify.mjs");
const smokeOk = runScript("production_smoke", "scripts/db-prod-smoke.mjs", {
  CONFIRM_PRODUCTION_SMOKE: "true",
});

report.deploy = {
  api_health: health.ok ? "PASS" : "FAIL",
  api_health_detail: CANONICAL_API_BASE,
};
report.production.worker_database_target_debug = report.probes.worker_database_target_debug ?? {
  status: "SKIPPED",
};
report.production.worker_bhudhi_debug = report.probes.worker_bhudhi_debug ?? { status: "SKIPPED" };

const hardFails = [];
if (!health.ok) hardFails.push(FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL);
if (auth.ok && !canonicalDebugOk) hardFails.push(report.probes.worker_database_target_debug?.class);
if (!runtimeDbOk && report.production.runtime_database_connection?.status === "FAIL") {
  hardFails.push(FAILURE_CLASSES.DATABASE_URL_AUTH_FAILED);
}

report.blockers = [
  ...new Set([
    ...report.blockers,
    ...hardFails.filter(Boolean),
    ...(eventsOk ? [] : ["events:prod:verify failed"]),
    ...(bhudhiOk ? [] : ["bhudhi:prod:verify failed"]),
    ...(smokeOk ? [] : ["production smoke failed"]),
  ]),
];

report.verdict =
  hardFails.length === 0 && eventsOk && bhudhiOk && smokeOk
    ? supabaseMgmt.warn
      ? "PRODUCTION_READY — Supabase Management API config read timed out (non-blocking)"
      : "PRODUCTION_READY"
    : hardFails.length && health.ok && canonicalDebugOk
      ? "CONDITIONAL — runtime scripts incomplete"
      : "NOT_READY";

mkdirSync(reportsDir, { recursive: true });
writeFileSync(outJson, JSON.stringify(report, null, 2), "utf8");
console.log(`\nWrote ${outJson}`);

spawnSync(process.execPath, [join(root, "scripts/generate-production-readiness-report.mjs")], {
  cwd: root,
  stdio: "inherit",
});

process.exit(hardFails.length === 0 && eventsOk && bhudhiOk && smokeOk ? 0 : 1);
