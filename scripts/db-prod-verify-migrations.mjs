#!/usr/bin/env node
/**
 * Production migration ledger verification (read-only).
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm db:prod:verify-migrations
 */
import {
  connectProductionWithFallback,
  checkMigrationLedgers,
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
  console.log("Production Migration Verification");
  console.log("");

  const ledger = await checkMigrationLedgers(client);
  console.log(`Manual migrations on disk: ${ledger.manualFiles}`);
  console.log(`Manual migrations in ledger: ${ledger.manualApplied}`);
  console.log(`Drizzle journal entries: ${ledger.drizzleJournalCount}`);
  console.log(`Drizzle applied: ${ledger.drizzleApplied}`);
  console.log(`Drizzle pending (estimate): ${ledger.drizzlePending}`);
  console.log("");

  console.log("Migration categories");
  for (const cat of ledger.categoryStatus) {
    const status = cat.ok ? "PASS" : "WARN";
    console.log(
      `${cat.category.padEnd(32)} ${status}  manual files=${cat.manualFiles} applied=${cat.manualApplied}`,
    );
  }

  if (ledger.manualMissing.length > 0) {
    console.log("");
    console.log(`Manual migrations not in ledger (${ledger.manualMissing.length}):`);
    for (const f of ledger.manualMissing.slice(0, 15)) {
      console.log(`  - ${f}`);
    }
    if (ledger.manualMissing.length > 15) {
      console.log(`  ... and ${ledger.manualMissing.length - 15} more`);
    }
  }

  console.log("");
  const ok =
    ledger.manualApplied >= ledger.manualFiles - 4 &&
    ledger.drizzlePending <= 10;
  console.log(`Result: ${ok ? "PASS" : "WARN — review missing migrations before schema changes"}`);
  process.exit(ok ? 0 : 1);
} finally {
  await client.end();
}
