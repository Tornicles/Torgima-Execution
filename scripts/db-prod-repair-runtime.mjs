#!/usr/bin/env node
/**
 * Production-safe runtime repair — idempotent partial indexes + Erector catalog seed only.
 * Never drops tables or truncates user data.
 *
 * Usage:
 *   CONFIRM_PRODUCTION_REPAIR=true pnpm db:prod:repair-runtime
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectProductionClient,
  connectProductionWithFallback,
  getIndexPresence,
  getSeedCounts,
  hasRepairConfirm,
  loadProductionEnv,
  maskDatabaseTarget,
  resolveProductionDatabaseUrlCandidates,
  REQUIRED_PARTIAL_INDEXES,
} from "./db-prod-common.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadProductionEnv();

if (!hasRepairConfirm()) {
  console.error(
    "Production repair requires CONFIRM_PRODUCTION_REPAIR=true (or TORGIMA_PROD_CONFIRM=1 / --confirm).",
  );
  console.error("This inserts missing catalog rows and creates missing indexes only.");
  process.exit(1);
}

const directUrl = resolveProductionDatabaseUrlCandidates()[0];
if (!directUrl) {
  console.error("No production database URL configured.");
  process.exit(1);
}
const target = maskDatabaseTarget(directUrl);
console.log(`[db-prod-repair-runtime] Target: ${target.host}:${target.port}`);
console.log("[db-prod-repair-runtime] Read-only before snapshot...");

const { client, url: connectedUrl, target: connectedTarget } = await connectProductionWithFallback();
console.log(`Connected via ${connectedTarget.connectionKind}`);
const seedsBefore = await getSeedCounts(client);
const indexesBefore = await getIndexPresence(client);
await client.end();

console.log("");
console.log("Production Erector Seed Verification (before repair)");
console.log("Table".padEnd(36) + "Before".padEnd(8) + "Minimum".padEnd(10) + "Status");
for (const row of seedsBefore) {
  const status = row.missing ? "NEEDS_REPAIR" : "OK";
  console.log(`${row.table.padEnd(36)}${String(row.count).padEnd(8)}${String(row.minimum).padEnd(10)}${status}`);
}

console.log("");
console.log("Production Partial Index Verification (before repair)");
for (const row of indexesBefore) {
  console.log(`${row.name.padEnd(42)} ${row.exists ? "YES" : "NO"}`);
}

const env = { ...process.env, DATABASE_URL: connectedUrl, DIRECT_URL: connectedUrl };
const needsSeedRepair = seedsBefore.some((s) => s.missing);
const needsIndexRepair = indexesBefore.some((i) => !i.exists);

if (!needsSeedRepair && !needsIndexRepair) {
  console.log("");
  console.log("[db-prod-repair-runtime] Nothing to repair — catalog and indexes already present.");
} else {
  if (needsIndexRepair) {
    console.log("");
    console.log("[db-prod-repair-runtime] Applying partial indexes (idempotent)...");
    let step = spawnSync(process.execPath, [join(root, "scripts/apply-partial-indexes.mjs")], {
      cwd: root,
      stdio: "inherit",
      env,
    });
    if (step.status !== 0) process.exit(step.status ?? 1);
  }

  if (needsSeedRepair) {
    console.log("[db-prod-repair-runtime] Applying Erector catalog seed (idempotent)...");
    let step = spawnSync(
      "pnpm",
      ["-F", "@workspace/db", "exec", "tsx", "../../scripts/apply-erector-seed.mjs"],
      { cwd: root, stdio: "inherit", env, shell: true },
    );
    if (step.status !== 0) process.exit(step.status ?? 1);
  }
}

const afterClient = await connectProductionClient(connectedUrl);
const seedsAfter = await getSeedCounts(afterClient);
const indexesAfter = await getIndexPresence(afterClient);

// Check for index conflicts (duplicate active/current rows)
let indexBlocked = [];
for (const spec of indexesAfter.filter((i) => !indexesBefore.find((b) => b.name === i.name)?.exists && !i.exists)) {
  indexBlocked.push({ name: spec.name, reason: "still missing after repair" });
}

// Re-check missing indexes and try to detect duplicate violations
for (const name of REQUIRED_PARTIAL_INDEXES) {
  const after = indexesAfter.find((i) => i.name === name);
  if (!after?.exists) {
    try {
      const sqlPath = join(root, "scripts/apply-partial-indexes.sql");
      const sqlText = readFileSync(sqlPath, "utf8");
      const idxSql = sqlText
        .split(";")
        .find((s) => s.includes(name));
      if (idxSql) await afterClient.query(idxSql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate key|unique constraint/i.test(msg)) {
        indexBlocked.push({ name, reason: "BLOCKED_BY_DUPLICATE_PRODUCTION_DATA" });
      }
    }
  }
}

const seedsAfterFinal = await getSeedCounts(afterClient);
const indexesAfterFinal = await getIndexPresence(afterClient);
await afterClient.end();

console.log("");
console.log("Production Erector Seed Verification");
console.log("Table".padEnd(36) + "Before".padEnd(8) + "After".padEnd(8) + "Status");
for (const after of seedsAfterFinal) {
  const before = seedsBefore.find((b) => b.table === after.table);
  const repaired = before?.missing && !after.missing;
  const status = after.missing ? "FAIL" : repaired ? "REPAIRED" : "PASS";
  console.log(
    `${after.table.padEnd(36)}${String(before?.count ?? 0).padEnd(8)}${String(after.count).padEnd(8)}${status}`,
  );
}

console.log("");
console.log("Production Partial Index Verification");
console.log("Index Name".padEnd(42) + "Before".padEnd(8) + "After".padEnd(8) + "Status");
for (const after of indexesAfterFinal) {
  const before = indexesBefore.find((b) => b.name === after.name);
  const blocked = indexBlocked.find((b) => b.name === after.name);
  let status = after.exists ? (before?.exists ? "PASS" : "REPAIRED") : "FAIL";
  if (blocked) status = blocked.reason;
  console.log(
    `${after.name.padEnd(42)}${before?.exists ? "YES" : "NO"}`.padEnd(50) +
      `${after.exists ? "YES" : "NO"}`.padEnd(8) +
      status,
  );
}

if (indexBlocked.length) {
  console.log("");
  console.log("Index remediation required (manual, non-destructive):");
  for (const b of indexBlocked) {
    console.log(`  - ${b.name}: ${b.reason}`);
    console.log("    Query duplicate rows for the partial index predicate, merge or deactivate extras.");
  }
}

console.log("");
const ok = seedsAfterFinal.every((s) => !s.missing) && indexesAfterFinal.every((i) => i.exists);
console.log(ok ? "Production repair: PASS" : "Production repair: INCOMPLETE");
process.exit(ok ? 0 : 1);
