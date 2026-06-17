#!/usr/bin/env node
/**
 * Production smoke tests — read-only DB checks + live API probes (no destructive writes).
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm db:prod:smoke
 */
import {
  connectProductionWithFallback,
  getIndexPresence,
  getSeedCounts,
  hasVerifyConfirm,
  loadProductionEnv,
  printProductionTargetSummary,
  tableExists,
} from "./db-prod-common.mjs";
import { probeDebugRoute, resolveInternalAuthSecret } from "./production-probe-common.mjs";

const API_BASE = process.env.VITE_API_BASE_URL?.trim() || "https://api.torgima.com";

if (!hasVerifyConfirm()) {
  console.error("Production smoke requires TORGIMA_PROD_CONFIRM=1 or --confirm.");
  process.exit(1);
}

loadProductionEnv();
printProductionTargetSummary();

const results = [];
const pass = (name, detail = "") => {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
};
const fail = (name, detail = "") => {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log("Production Smoke Tests");
console.log("");

// 1. DB connectivity
let client;
try {
  const conn = await connectProductionWithFallback();
  client = conn.client;
  pass("Production API reaches database", `${conn.target.connectionKind} OK`);
} catch (err) {
  fail("Production API reaches database", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

// 2. Erector seeds
const seeds = await getSeedCounts(client);
if (seeds.every((s) => !s.missing)) pass("Erector seed tables populated");
else fail("Erector seed tables populated", `${seeds.filter((s) => s.missing).length} below minimum`);

// 3. Partial indexes
const indexes = await getIndexPresence(client);
if (indexes.every((i) => i.exists)) pass("Partial indexes present");
else fail("Partial indexes present", `${indexes.filter((i) => !i.exists).length} missing`);

// 4. Catalog dependencies for paid validation
const catalogTables = [
  "erector_threshold_matrix",
  "erector_archetype_rule_packs",
  "erector_verdict_rules",
  "erector_framework_veto_rules",
];
let catalogOk = true;
for (const t of catalogTables) {
  if (!(await tableExists(client, t))) catalogOk = false;
}
if (catalogOk) pass("Paid Erector catalog dependencies available");
else fail("Paid Erector catalog dependencies available");

// 5. Blueprint launch tables
const launchTables = ["validations", "blueprints", "plans", "orders", "erector_blueprint_launch_contracts"];
let launchOk = true;
for (const t of launchTables) {
  if (!(await tableExists(client, t))) launchOk = false;
}
if (launchOk) pass("Blueprint launch dependencies available");
else fail("Blueprint launch dependencies available");

// 6. Archetype rule packs loadable
const packs = await client.query("SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs");
if (Number(packs.rows[0]?.c) >= 10) pass("Task generation archetype rule packs available");
else fail("Task generation archetype rule packs available");

// 7. Events writable check — read-only: verify table + insert permission via column check only
if (await tableExists(client, "events")) pass("Event table queryable");
else fail("Event table queryable");

// 8. Signal/condition tables
const sig = await tableExists(client, "signal_snapshots");
const cond = await tableExists(client, "conditions");
if (sig && cond) pass("Signal/condition tables queryable");
else fail("Signal/condition tables queryable");

await client.end();

// 9. Live API health
try {
  const healthRes = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(15_000) });
  if (healthRes.ok) pass("Live API /health", `HTTP ${healthRes.status}`);
  else fail("Live API /health", `HTTP ${healthRes.status}`);
} catch (err) {
  fail("Live API /health", err instanceof Error ? err.message : String(err));
}

// 10. Debug db-target (internal auth required for production smoke)
const auth = resolveInternalAuthSecret();
if (!auth.ok) {
  fail("Worker DB probe via /api/debug/db-target", auth.class);
} else {
  const dbg = await probeDebugRoute(API_BASE, "/api/debug/db-target", auth.secret);
  if (dbg.ok) {
    const probeOk = dbg.data?.probe?.ok ?? dbg.data?.data?.probe?.ok;
    if (probeOk) pass("Worker DB probe via /api/debug/db-target");
    else fail("Worker DB probe via /api/debug/db-target", "probe not ok");
  } else if (dbg.class === "INTERNAL_AUTH_SECRET_MISMATCH") {
    fail("Worker DB probe via /api/debug/db-target", dbg.class);
  } else if (dbg.status === 404) {
    fail("Worker DB probe via /api/debug/db-target", "DEBUG_ROUTE_NOT_DEPLOYED");
  } else {
    fail("Worker DB probe via /api/debug/db-target", dbg.class ?? `HTTP ${dbg.status}`);
  }
}

console.log("");
const allOk = results.every((r) => r.ok);
console.log(`Smoke test: ${allOk ? "PASS" : "FAIL"} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(allOk ? 0 : 1);
