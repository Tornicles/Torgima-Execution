#!/usr/bin/env node
/**
 * Database runtime readiness — schema, partial indexes, Erector catalog.
 * Bhudhi fallback and event queue issues are warnings only (Prompt 3/4).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { REQUIRED_PARTIAL_INDEXES } from "./partial-indexes.constants.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[db-verify-runtime] DATABASE_URL or DIRECT_URL is required");
  process.exit(1);
}

const isProd = process.argv.includes("--prod");
const header = isProd ? "PRODUCTION DATABASE RUNTIME VERIFY" : "DATABASE RUNTIME VERIFY";
console.log(header);
console.log("");

process.env.DATABASE_URL = databaseUrl;

const { db, pool } = await import("@workspace/db");
const { verifyErectorSeedCatalog, printErectorSeedVerification } = await import("@workspace/db/erector-seed");
const { checkSchemaHealth } = await import("../artifacts/api-server/src/lib/verifySchema.ts");

let schemaOk = false;
let indexesOk = false;
let seedsOk = false;
const warnings = [];

try {
  const health = await checkSchemaHealth();
  schemaOk = health.ok;
  console.log(`Schema: ${schemaOk ? "PASS" : "FAIL"}`);
  if (!schemaOk) {
    for (const line of health.missing.slice(0, 20)) {
      console.log(`  - ${line}`);
    }
    if (health.missing.length > 20) {
      console.log(`  ... and ${health.missing.length - 20} more`);
    }
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])`,
      [REQUIRED_PARTIAL_INDEXES],
    );
    indexesOk = rows.length === REQUIRED_PARTIAL_INDEXES.length;
    console.log(`Partial indexes: ${indexesOk ? "PASS" : "FAIL"} (${rows.length}/${REQUIRED_PARTIAL_INDEXES.length})`);
    if (!indexesOk) {
      const found = new Set(rows.map((r) => r.indexname));
      for (const name of REQUIRED_PARTIAL_INDEXES) {
        if (!found.has(name)) console.log(`  - missing ${name}`);
      }
    }

    const flagResult = await client.query(
      `SELECT enabled FROM feature_flags WHERE feature_name = 'bhudhi_force_fallbacks' LIMIT 1`,
    );
    const bhudhiFallback = flagResult.rows[0]?.enabled === true;
    if (bhudhiFallback) {
      warnings.push("Bhudhi fallback flag: bhudhi_force_fallbacks=true (Prompt 3)");
      console.log("Bhudhi fallback flag: WARN");
    } else {
      console.log("Bhudhi fallback flag: OK");
    }

    const pendingEvents = await client.query(
      `SELECT COUNT(*)::int AS c FROM events WHERE status IN ('pending', 'processing')`,
    ).catch(() => ({ rows: [{ c: 0 }] }));
    const deadLetters = await client.query(
      `SELECT COUNT(*)::int AS c FROM dead_letter_events`,
    ).catch(() => ({ rows: [{ c: 0 }] }));
    const pending = Number(pendingEvents.rows[0]?.c ?? 0);
    const dlq = Number(deadLetters.rows[0]?.c ?? 0);
    if (pending > 0 || dlq > 0) {
      warnings.push(`Event queue: ${pending} pending, ${dlq} dead letters (Prompt 4)`);
      console.log(`Event queue: WARN (${pending} pending, ${dlq} dead letters)`);
    } else {
      console.log("Event queue: OK");
    }
  } finally {
    await client.end();
  }

  const seedResult = await verifyErectorSeedCatalog(db);
  seedsOk = seedResult.ok;
  console.log(`Erector seed catalog: ${seedsOk ? "PASS" : "FAIL"}`);
  console.log("");
  printErectorSeedVerification(seedResult);

  if (warnings.length > 0) {
    console.log("");
    console.log("Warnings (non-blocking for Prompt 1):");
    for (const w of warnings) console.log(`  - ${w}`);
  }

  const allOk = schemaOk && indexesOk && seedsOk;
  console.log("");
  if (isProd) {
    console.log(allOk ? "Production runtime database: READY FOR PROMPT 3" : "Production runtime database: NOT READY");
  } else {
    console.log(allOk ? "Runtime database: READY" : "Runtime database: NOT READY");
  }

  process.exit(allOk ? 0 : 1);
} finally {
  await pool.end().catch(() => undefined);
}
