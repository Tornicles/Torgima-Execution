#!/usr/bin/env node
/**
 * Production partial unique index verification (read-only).
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm db:prod:verify-indexes
 */
import {
  connectProductionWithFallback,
  getIndexPresence,
  hasVerifyConfirm,
  printProductionTargetSummary,
  REQUIRED_PARTIAL_INDEXES,
} from "./db-prod-common.mjs";

if (!hasVerifyConfirm()) {
  console.error("Production verify requires TORGIMA_PROD_CONFIRM=1 or --confirm (read-only).");
  process.exit(1);
}

printProductionTargetSummary();
const { client, target } = await connectProductionWithFallback();
console.log(`Connected via ${target.connectionKind} (${target.host}:${target.port})`);

try {
  const indexes = await getIndexPresence(client);
  console.log("Production Partial Index Verification");
  console.log("");
  console.log("Index Name".padEnd(42) + "Exists".padEnd(8) + "Status");
  let ok = true;
  for (const row of indexes) {
    const status = row.exists ? "PASS" : "FAIL";
    if (!row.exists) ok = false;
    console.log(`${row.name.padEnd(42)}${row.exists ? "YES" : "NO"}`.padEnd(50) + status);
  }
  console.log("");
  console.log(`Required: ${REQUIRED_PARTIAL_INDEXES.length} indexes`);
  console.log(`Result: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
} finally {
  await client.end();
}
