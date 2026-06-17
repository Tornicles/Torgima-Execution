#!/usr/bin/env node
/**
 * Post-deploy production probe — canonical api.torgima.com first; workers.dev optional.
 * Usage (GitHub Actions): INTERNAL_AUTH_SECRET from secrets required.
 */
import {
  CANONICAL_API_BASE,
  FAILURE_CLASSES,
  probeDebugRoute,
  probeHealth,
  printProbeResult,
  resolveInternalAuthSecret,
  resolveWorkersDevUrl,
} from "./production-probe-common.mjs";

const deployOnly = process.argv.includes("--deploy-only");
const results = [];

function record(name, result) {
  results.push({ name, ...result });
  printProbeResult(name, result);
}

console.log("Production Deploy Verification");
console.log(`Canonical API: ${CANONICAL_API_BASE}`);
console.log("");

const auth = resolveInternalAuthSecret();
if (!auth.ok) {
  console.error(`FAIL  Missing INTERNAL_AUTH_SECRET GitHub secret [${auth.class}]`);
  process.exit(1);
}

const health = await probeHealth(CANONICAL_API_BASE);
record("Canonical API /health", health);

const dbTarget = await probeDebugRoute(
  CANONICAL_API_BASE,
  "/api/debug/db-target",
  auth.secret,
);
record("Canonical /api/debug/db-target", {
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
record("Canonical /api/debug/bhudhi-runtime", {
  ...bhudhi,
  class: bhudhi.ok ? FAILURE_CLASSES.CANONICAL_DEBUG_BHUDHI_PASS : bhudhi.class,
});

const workersDev = resolveWorkersDevUrl();
console.log("");
console.log(`Optional workers.dev base: ${workersDev}`);

const workersHealth = await probeHealth(workersDev);
record("workers.dev /health (optional)", {
  ...workersHealth,
  warn: !workersHealth.ok,
  class: workersHealth.ok
    ? FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS
    : FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL,
});

const workersDb = await probeDebugRoute(workersDev, "/api/debug/db-target", auth.secret);
const workersDbClass =
  workersDb.status === 404 || workersDb.class === FAILURE_CLASSES.DEBUG_ROUTE_NOT_DEPLOYED
    ? FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL
    : workersDb.ok
      ? FAILURE_CLASSES.WORKERS_DEV_DEBUG_PASS
      : workersDb.class;

record("workers.dev /api/debug/db-target (optional)", {
  ...workersDb,
  warn: !workersDb.ok,
  class: workersDbClass,
});

console.log("");
const canonicalOk = health.ok && dbTarget.ok;
const workersOptionalOk =
  !workersDb.ok &&
  (workersDbClass === FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL ||
    workersDb.status === 404);

if (!health.ok) {
  console.error(`Deploy verify failed: ${FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL}`);
  process.exit(1);
}

if (!dbTarget.ok) {
  if (dbTarget.class === FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH) {
    console.error(`Deploy verify failed: ${FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH}`);
    process.exit(1);
  }
  if (dbTarget.class === FAILURE_CLASSES.DEBUG_ROUTE_NOT_DEPLOYED) {
    console.error(`Deploy verify failed: ${FAILURE_CLASSES.DEBUG_ROUTE_NOT_DEPLOYED}`);
    process.exit(1);
  }
  console.error(`Deploy verify failed: canonical db-target probe (${dbTarget.class})`);
  process.exit(1);
}

if (workersOptionalOk) {
  console.log(`NOTE  ${FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL} — canonical probes passed`);
}

if (!deployOnly && !bhudhi.ok && bhudhi.class === FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH) {
  console.error(`WARN  bhudhi-runtime: ${FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH}`);
}

console.log("");
console.log(deployOnly ? "Deploy probe: PASS" : "Production deploy verification: PASS");
process.exit(0);
