#!/usr/bin/env node
/**
 * Production Erector seed catalog verification (read-only).
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm db:prod:verify-seeds
 */
import {
  connectProductionWithFallback,
  getSeedCounts,
  hasVerifyConfirm,
  printProductionTargetSummary,
} from "./db-prod-common.mjs";

if (!hasVerifyConfirm()) {
  console.error("Production verify requires TORGIMA_PROD_CONFIRM=1 or --confirm (read-only).");
  process.exit(1);
}

printProductionTargetSummary();
const { client, target } = await connectProductionWithFallback();
console.log(`Connected via ${target.connectionKind} (${target.host}:${target.port})`);

try {
  const counts = await getSeedCounts(client);
  console.log("Production Erector Seed Verification");
  console.log("");
  console.log("Table".padEnd(36) + "Count".padEnd(8) + "Minimum".padEnd(10) + "Status");
  let ok = true;
  for (const row of counts) {
    const status = !row.exists ? "MISSING TABLE" : row.missing ? "FAIL" : "PASS";
    if (row.missing || !row.exists) ok = false;
    console.log(
      `${row.table.padEnd(36)}${String(row.count).padEnd(8)}${String(row.minimum).padEnd(10)}${status}`,
    );
  }
  console.log("");
  console.log(`Result: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
} finally {
  await client.end();
}
