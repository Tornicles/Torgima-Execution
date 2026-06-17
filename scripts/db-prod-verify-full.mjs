#!/usr/bin/env node
/**
 * Full production database runtime verification report (read-only).
 */
import {
  REQUIRED_BHUDHI_TABLES,
  REQUIRED_COLUMNS,
  REQUIRED_CORE_TABLES,
  REQUIRED_ERECTOR_TABLES,
  REQUIRED_HANDOFF_TABLES,
  columnExists,
  connectProductionWithFallback,
  getFeatureFlags,
  getIndexPresence,
  getLatestDeadLetters,
  getSeedCounts,
  getTopPendingEvents,
  checkMigrationLedgers,
  queryRuntimeState,
  tableExists,
  printProductionTargetSummary,
} from "./db-prod-common.mjs";

printProductionTargetSummary();
const { client, target } = await connectProductionWithFallback();
console.log(`Connected via ${target.connectionKind} (${target.host}:${target.port})`);
console.log("");

const report = {
  targetOk: false,
  migrationsOk: false,
  tablesOk: false,
  columnsOk: false,
  seedsOk: false,
  indexesOk: false,
};

try {
  report.targetOk = printProductionTargetSummary();

  console.log("═".repeat(60));
  console.log("MIGRATION STATUS");
  const ledger = await checkMigrationLedgers(client);
  report.migrationsOk = ledger.manualApplied >= ledger.manualFiles - 4;
  console.log(`Manual ledger: ${ledger.manualApplied}/${ledger.manualFiles}`);
  console.log(`Drizzle applied: ${ledger.drizzleApplied}/${ledger.drizzleJournalCount}`);
  for (const cat of ledger.categoryStatus) {
    console.log(`  ${cat.category}: ${cat.ok ? "PASS" : "WARN"} (${cat.manualApplied}/${cat.manualFiles})`);
  }
  if (ledger.manualMissing.length) {
    console.log(`  Unledgered manual files: ${ledger.manualMissing.length}`);
  }
  console.log("");

  console.log("═".repeat(60));
  console.log("REQUIRED TABLES");
  const allTables = [
    ...REQUIRED_CORE_TABLES.map((t) => ({ group: "core", name: t })),
    ...REQUIRED_ERECTOR_TABLES.map((t) => ({ group: "erector", name: t })),
    ...REQUIRED_BHUDHI_TABLES.map((t) => ({ group: "bhudhi", name: t })),
    ...REQUIRED_HANDOFF_TABLES.map((t) => ({ group: "handoff", name: t })),
  ];
  const missingTables = [];
  for (const { group, name } of allTables) {
    const exists = await tableExists(client, name);
    if (!exists) missingTables.push(`${group}:${name}`);
    console.log(`${name.padEnd(40)} ${exists ? "PASS" : "FAIL"}`);
  }
  report.tablesOk = missingTables.length === 0;
  console.log("");

  console.log("═".repeat(60));
  console.log("CRITICAL COLUMNS");
  const missingColumns = [];
  for (const [table, column] of REQUIRED_COLUMNS) {
    const exists = await columnExists(client, table, column);
    if (!exists) missingColumns.push(`${table}.${column}`);
  }
  report.columnsOk = missingColumns.length === 0;
  console.log(`Checked ${REQUIRED_COLUMNS.length} columns — missing: ${missingColumns.length}`);
  if (missingColumns.length) {
    for (const c of missingColumns.slice(0, 20)) console.log(`  - ${c}`);
  }
  console.log("");

  console.log("═".repeat(60));
  console.log("ERECTOR SEED CATALOG");
  const seeds = await getSeedCounts(client);
  report.seedsOk = seeds.every((s) => s.exists && !s.missing);
  for (const s of seeds) {
    console.log(`${s.table.padEnd(36)} ${String(s.count).padEnd(6)} min=${s.minimum}  ${s.missing ? "FAIL" : "PASS"}`);
  }
  console.log("");

  console.log("═".repeat(60));
  console.log("PARTIAL UNIQUE INDEXES");
  const indexes = await getIndexPresence(client);
  report.indexesOk = indexes.every((i) => i.exists);
  for (const i of indexes) {
    console.log(`${i.name.padEnd(42)} ${i.exists ? "PASS" : "FAIL"}`);
  }
  console.log("");

  console.log("═".repeat(60));
  console.log("FEATURE FLAGS");
  const flags = await getFeatureFlags(client);
  for (const f of flags) {
    const warn =
      f.feature_name === "bhudhi_force_fallbacks" && f.enabled
        ? " WARN — Prompt 3"
        : f.feature_name === "degraded_mode" && f.enabled
          ? " WARN"
          : "";
    console.log(`${f.feature_name}: ${f.enabled}${warn}`);
  }
  console.log("");

  console.log("═".repeat(60));
  console.log("PRODUCTION RUNTIME STATE");
  const state = await queryRuntimeState(client);
  for (const [section, metrics] of Object.entries(state)) {
    console.log(`[${section}]`);
    for (const [key, val] of Object.entries(metrics)) {
      if (val.error) console.log(`  ${key}: ERROR (${val.error.slice(0, 80)})`);
      else console.log(`  ${key}: ${val.count}`);
    }
  }
  const pendingTypes = await getTopPendingEvents(client);
  if (pendingTypes.length) {
    console.log("  top pending event types:");
    for (const row of pendingTypes) console.log(`    ${row.event_type}: ${row.c}`);
  }
  const dlq = await getLatestDeadLetters(client);
  if (dlq.length) {
    console.log("  latest dead letters:");
    for (const row of dlq) console.log(`    ${row.event_type}: ${row.failure_reason}`);
  }
  console.log("");

  const allOk =
    report.targetOk &&
    report.tablesOk &&
    report.columnsOk &&
    report.seedsOk &&
    report.indexesOk;

  console.log("═".repeat(60));
  console.log(allOk ? "PRODUCTION RUNTIME DATABASE: READY FOR PROMPT 3" : "PRODUCTION RUNTIME DATABASE: NOT READY");
  process.exit(allOk ? 0 : 1);
} finally {
  await client.end();
}
