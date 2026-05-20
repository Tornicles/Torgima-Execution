#!/usr/bin/env node
/** Read-only schema compatibility diagnostic (no writes). */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

async function main() {
  const { pool } = await import("@workspace/db");

  const tables = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log("=== ALL PUBLIC TABLES ===");
  for (const r of tables.rows) console.log(r.tablename);

  const validationTables = await pool.query(`
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename LIKE '%validation%'
    ORDER BY t.tablename
  `);

  console.log("\n=== VALIDATION-RELATED TABLES ===");
  for (const r of validationTables.rows) {
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [r.tablename],
    );
    console.log(`\n-- ${r.tablename} (${cols.rows.length} columns) --`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name}: ${c.data_type}${c.is_nullable === "NO" ? " NOT NULL" : ""}`);
    }
  }

  const archetypeTables = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND (tablename LIKE '%archetype%' OR tablename LIKE '%econom%')
    ORDER BY tablename
  `);

  console.log("\n=== ARCHETYPE / ECONOMY TABLES ===");
  for (const r of archetypeTables.rows) console.log(r.tablename);

  const proposed = [
    "validation_results",
    "validation_scores",
    "validation_paths",
    "economic_archetypes",
    "validation_archetype_maps",
  ];
  console.log("\n=== PROPOSED ERECTOR TABLE CHECK ===");
  for (const name of proposed) {
    const exists = tables.rows.some((r) => r.tablename === name);
    console.log(`${name}: ${exists ? "YES" : "NO"}`);
  }

  const archetypeCount = await pool.query("SELECT COUNT(*)::int AS n FROM economic_archetypes");
  console.log("\neconomic_archetypes seeded rows:", archetypeCount.rows[0].n);

  const bpErector = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blueprints'
      AND column_name IN ('erector_validation_id','primary_archetype_id','reality_score','validation_scores','economy_briefing_summary')
    ORDER BY column_name
  `);
  console.log("blueprints Erector columns present:", bpErector.rows.map((r) => r.column_name).join(", ") || "(none)");

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
