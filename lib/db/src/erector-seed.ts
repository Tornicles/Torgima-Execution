/**
 * Erector v0.1 rule-table seeds — Prompt 1 TASK 4 order.
 * Authoritative for dev/CI/production repair: applies migrations/0043–0048 SQL idempotently,
 * then TypeScript upserts for model versions and threshold matrix.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema/index.js";
import {
  erectorModelVersions,
  erectorThresholdMatrix,
} from "./schema/index.js";

type Db = NodePgDatabase<typeof schema>;

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Root migration seed SQL — idempotent ON CONFLICT; safe to re-run. */
export const ERECTOR_SEED_SQL_FILES = [
  "migrations/0043_erector_schema_1_seed_data.sql",
  "migrations/0045_erector_schema_2_seed_data.sql",
  "migrations/0047_erector_schema_3_seed_data.sql",
  "migrations/0048_erector_prompt_1_seed_alignment.sql",
] as const;

export const ERECTOR_SEED_MINIMUMS = {
  erector_threshold_matrix: 3,
  erector_archetype_rule_packs: 10,
  erector_verdict_rules_active: 14,
  erector_model_versions: 10,
  erector_false_progress_patterns: 10,
  erector_capability_graph: 20,
  erector_framework_veto_rules: 1,
} as const;

export type ErectorSeedCheck = {
  table: string;
  label: string;
  count: number;
  minimum: number;
  passed: boolean;
  detail?: string;
};

export type ErectorSeedVerifyResult = {
  ok: boolean;
  checks: ErectorSeedCheck[];
  missing: string[];
};

const MODEL_VERSIONS = [
  { component: "validation_model", current_version: "v0.1", changelog: "Validation scoring and verdict rule engine" },
  { component: "simulation_model", current_version: "v0.1", changelog: "Simulation scoring and scenario generation" },
  { component: "economic_type_model", current_version: "v0.1", changelog: "Archetype classifier and router" },
  { component: "archetype_rule_pack", current_version: "v0.1", changelog: "All 10 archetype rule packs" },
  { component: "academy_rule", current_version: "v0.1", changelog: "Academy trigger and capability gap rules" },
  { component: "outcome_validation", current_version: "v0.1", changelog: "Outcome scoring and false progress detection" },
  { component: "framework_rule", current_version: "v0.1", changelog: "Framework veto rules" },
  { component: "signal_calculation", current_version: "v0.1", changelog: "13 Erector signal calculation methods" },
  { component: "proof_standard", current_version: "v0.1", changelog: "Evidence classification and strength scoring" },
  { component: "threshold_matrix", current_version: "v0.1", changelog: "v0.1 verdict thresholds per tier" },
] as const;

const THRESHOLD_MATRIX = [
  { tier: "starter", proceed_min_score: 60, adjust_min_score: 40, pivot_max_score: 39, demand_proof_min_class: 2 },
  { tier: "growth", proceed_min_score: 70, adjust_min_score: 45, pivot_max_score: 44, demand_proof_min_class: 3 },
  { tier: "ultimate", proceed_min_score: 75, adjust_min_score: 50, pivot_max_score: 49, demand_proof_min_class: 4 },
] as const;

/** Prompt 1 critical rule IDs — must exist after seed. */
export const CRITICAL_VERDICT_RULE_IDS = [
  "VR-001", "VR-002", "VR-003", "VR-010", "VR-011", "VR-020", "VR-021",
  "VR-030", "VR-031", "VR-040", "VR-041", "VR-050", "VR-060", "VR-070",
] as const;

export async function seedErectorModelVersions(db: Db): Promise<number> {
  let n = 0;
  for (const row of MODEL_VERSIONS) {
    await db
      .insert(erectorModelVersions)
      .values(row)
      .onConflictDoNothing();
    n++;
  }
  return n;
}

export async function seedErectorThresholdMatrix(db: Db): Promise<number> {
  for (const row of THRESHOLD_MATRIX) {
    await db.insert(erectorThresholdMatrix).values(row).onConflictDoNothing();
  }
  return THRESHOLD_MATRIX.length;
}

/** Apply authoritative Erector catalog SQL from root migrations (idempotent). */
export async function applyErectorSeedSqlFiles(pool: pg.Pool): Promise<void> {
  for (const rel of ERECTOR_SEED_SQL_FILES) {
    const path = join(REPO_ROOT, rel);
    const sqlText = readFileSync(path, "utf8");
    await pool.query(sqlText);
  }
}

export async function seedErectorArchetypeRulePacks(db: Db): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs`);
  return Number((result.rows[0] as { c: number }).c);
}

export async function seedErectorVerdictRules(db: Db): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM erector_verdict_rules WHERE active = true`,
  );
  return Number((result.rows[0] as { c: number }).c);
}

export async function seedErectorFrameworkVetoRules(db: Db): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_framework_veto_rules`);
  return Number((result.rows[0] as { c: number }).c);
}

export async function seedErectorCapabilityGraph(db: Db): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_capability_graph`);
  return Number((result.rows[0] as { c: number }).c);
}

export async function seedErectorFalseProgressPatterns(db: Db): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_false_progress_patterns`);
  return Number((result.rows[0] as { c: number }).c);
}

/** Run Prompt 1 seed order — fully authoritative; does not require migration runner. */
export async function seedErectorCatalog(db: Db): Promise<void> {
  const { pool } = await import("./index.js");
  await applyErectorSeedSqlFiles(pool);
  await seedErectorModelVersions(db);
  await seedErectorThresholdMatrix(db);

  const verify = await verifyErectorSeedCatalog(db);
  printErectorSeedVerification(verify);
  if (!verify.ok) {
    const missing = verify.missing.join(", ");
    throw new Error(`seedErectorCatalog did not populate required catalog rows: ${missing}`);
  }
}

export async function verifyErectorSeedCatalog(db: Db): Promise<ErectorSeedVerifyResult> {
  const checks: ErectorSeedCheck[] = [];

  const threshold = Number(
    ((await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_threshold_matrix`)).rows[0] as { c: number }).c,
  );
  checks.push({
    table: "erector_threshold_matrix",
    label: "erector_threshold_matrix",
    count: threshold,
    minimum: ERECTOR_SEED_MINIMUMS.erector_threshold_matrix,
    passed: threshold >= ERECTOR_SEED_MINIMUMS.erector_threshold_matrix,
  });

  const archetypes = Number(
    ((await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs`)).rows[0] as { c: number }).c,
  );
  const archetypeNulls = Number(
    (
      (await db.execute(
        sql`SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs
            WHERE archetype_id IS NULL OR archetype_name IS NULL OR core_risk IS NULL`,
      )).rows[0] as { c: number }
    ).c,
  );
  checks.push({
    table: "erector_archetype_rule_packs",
    label: "erector_archetype_rule_packs",
    count: archetypes,
    minimum: ERECTOR_SEED_MINIMUMS.erector_archetype_rule_packs,
    passed:
      archetypes >= ERECTOR_SEED_MINIMUMS.erector_archetype_rule_packs && archetypeNulls === 0,
    detail: archetypeNulls > 0 ? `${archetypeNulls} rows missing core fields` : undefined,
  });

  const verdicts = Number(
    (
      (await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_verdict_rules WHERE active = true`)).rows[0] as {
        c: number;
      }
    ).c,
  );
  checks.push({
    table: "erector_verdict_rules",
    label: "erector_verdict_rules",
    count: verdicts,
    minimum: ERECTOR_SEED_MINIMUMS.erector_verdict_rules_active,
    passed: verdicts >= ERECTOR_SEED_MINIMUMS.erector_verdict_rules_active,
    detail: "active rows",
  });

  const modelVersions = Number(
    ((await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_model_versions`)).rows[0] as { c: number }).c,
  );
  checks.push({
    table: "erector_model_versions",
    label: "erector_model_versions",
    count: modelVersions,
    minimum: ERECTOR_SEED_MINIMUMS.erector_model_versions,
    passed: modelVersions >= ERECTOR_SEED_MINIMUMS.erector_model_versions,
  });

  const patterns = Number(
    (
      (await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_false_progress_patterns`)).rows[0] as { c: number }
    ).c,
  );
  checks.push({
    table: "erector_false_progress_patterns",
    label: "erector_false_progress_patterns",
    count: patterns,
    minimum: ERECTOR_SEED_MINIMUMS.erector_false_progress_patterns,
    passed: patterns >= ERECTOR_SEED_MINIMUMS.erector_false_progress_patterns,
  });

  const capabilities = Number(
    ((await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_capability_graph`)).rows[0] as { c: number }).c,
  );
  checks.push({
    table: "erector_capability_graph",
    label: "erector_capability_graph",
    count: capabilities,
    minimum: ERECTOR_SEED_MINIMUMS.erector_capability_graph,
    passed: capabilities >= ERECTOR_SEED_MINIMUMS.erector_capability_graph,
  });

  const vetoes = Number(
    (
      (await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_framework_veto_rules`)).rows[0] as { c: number }
    ).c,
  );
  checks.push({
    table: "erector_framework_veto_rules",
    label: "erector_framework_veto_rules",
    count: vetoes,
    minimum: ERECTOR_SEED_MINIMUMS.erector_framework_veto_rules,
    passed: vetoes >= ERECTOR_SEED_MINIMUMS.erector_framework_veto_rules,
  });

  const missing = checks.filter((c) => !c.passed).map((c) => c.table);
  return { ok: missing.length === 0, checks, missing };
}

export function printErectorSeedVerification(result: ErectorSeedVerifyResult): void {
  console.log("Erector seed verification");
  for (const check of result.checks) {
    const status = check.passed ? "PASS" : "FAIL";
    const suffix = check.detail ? ` ${check.detail}` : "";
    console.log(`${check.label.padEnd(34)} ${status}  ${check.count} rows${suffix}`);
  }
  console.log("");
  console.log(`Result: ${result.ok ? "PASS" : "FAIL"}`);
  if (!result.ok) {
    console.log(`Missing: ${result.missing.join(", ")}`);
    console.log("Action: seedErectorCatalog did not populate required catalog rows");
  }
}

export async function verifyErectorSchema(db: Db): Promise<boolean> {
  const checks: Array<{ label: string; sql: ReturnType<typeof sql>; min: number; max?: number }> = [
    {
      label: "users.dashboard_mode + erector_tier",
      sql: sql`SELECT COUNT(*)::int AS c FROM information_schema.columns
        WHERE table_name = 'users' AND column_name IN ('dashboard_mode','erector_tier')`,
      min: 2,
      max: 2,
    },
    {
      label: "blueprints erector columns",
      sql: sql`SELECT COUNT(*)::int AS c FROM information_schema.columns
        WHERE table_name = 'blueprints' AND column_name IN (
          'erector_state','erector_validation_id','erector_simulation_id',
          'erector_archetype','erector_launch_contract_id','blueprint_source')`,
      min: 6,
      max: 6,
    },
    {
      label: "erector_ tables",
      sql: sql`SELECT COUNT(*)::int AS c FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'erector_%'`,
      min: 27,
    },
    { label: "erector_threshold_matrix", sql: sql`SELECT COUNT(*)::int AS c FROM erector_threshold_matrix`, min: 3, max: 3 },
    { label: "erector_archetype_rule_packs", sql: sql`SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs`, min: 10 },
    { label: "erector_verdict_rules active", sql: sql`SELECT COUNT(*)::int AS c FROM erector_verdict_rules WHERE active = true`, min: 14 },
    { label: "erector_model_versions", sql: sql`SELECT COUNT(*)::int AS c FROM erector_model_versions`, min: 10, max: 10 },
    { label: "erector_false_progress_patterns", sql: sql`SELECT COUNT(*)::int AS c FROM erector_false_progress_patterns`, min: 10, max: 10 },
    { label: "erector_capability_graph", sql: sql`SELECT COUNT(*)::int AS c FROM erector_capability_graph`, min: 20 },
    {
      label: "erector_framework_veto_rules",
      sql: sql`SELECT COUNT(*)::int AS c FROM erector_framework_veto_rules`,
      min: ERECTOR_SEED_MINIMUMS.erector_framework_veto_rules,
    },
  ];

  let ok = true;
  for (const check of checks) {
    const result = await db.execute(check.sql);
    const count = Number((result.rows[0] as { c: number }).c);
    const pass =
      count >= check.min && (check.max === undefined || count <= check.max);
    console.log(pass ? "OK" : "FAIL", check.label, count, `(expected >= ${check.min}${check.max !== undefined ? `, <= ${check.max}` : ""})`);
    if (!pass) ok = false;
  }

  for (const ruleId of CRITICAL_VERDICT_RULE_IDS) {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM erector_verdict_rules WHERE rule_id = ${ruleId} AND active = true`,
    );
    const count = Number((result.rows[0] as { c: number }).c);
    if (count !== 1) {
      console.log("FAIL", `critical rule ${ruleId}`);
      ok = false;
    }
  }

  await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM erector_blueprint_launch_contracts blc
    JOIN blueprints b ON b.id = blc.blueprint_id
  `);

  return ok;
}

// CLI: tsx src/erector-seed.ts [--verify-only]
const invokedPath = process.argv[1]?.replace(/\\/g, "/") ?? "";
const runAsCli =
  invokedPath.endsWith("/erector-seed.ts") ||
  invokedPath.endsWith("/src/erector-seed") ||
  invokedPath.endsWith("\\erector-seed.ts");
if (runAsCli) {
  const verifyOnly = process.argv.includes("--verify-only");
  const { db, pool } = await import("./index.js");
  try {
    if (!verifyOnly) await seedErectorCatalog(db);
    else {
      const seedVerify = await verifyErectorSeedCatalog(db);
      printErectorSeedVerification(seedVerify);
      if (!seedVerify.ok) process.exit(1);
    }
    const ok = await verifyErectorSchema(db);
    if (!ok) process.exit(1);
    console.log(verifyOnly ? "Erector schema verification passed." : "Erector seed + verification passed.");
  } finally {
    await pool.end();
  }
}
