/**
 * Erector v0.1 rule-table seeds — Prompt 1 TASK 4 order.
 * SQL migrations 0043–0047 + 0048 are authoritative; this module re-runs seeds idempotently for dev/CI.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema/index.js";
import {
  erectorModelVersions,
  erectorThresholdMatrix,
} from "./schema/index.js";

type Db = NodePgDatabase<typeof schema>;

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

export async function seedErectorArchetypeRulePacks(db: Db): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM erector_archetype_rule_packs`);
  const count = Number((result.rows[0] as { c: number }).c);
  return count;
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

/** Run Prompt 1 seed order; assumes migrations 0041–0048 applied. */
export async function seedErectorCatalog(db: Db): Promise<void> {
  const modelVersions = await seedErectorModelVersions(db);
  const threshold = await seedErectorThresholdMatrix(db);
  const archetypes = await seedErectorArchetypeRulePacks(db);
  const verdicts = await seedErectorVerdictRules(db);
  const vetoes = await seedErectorFrameworkVetoRules(db);
  const capabilities = await seedErectorCapabilityGraph(db);
  const patterns = await seedErectorFalseProgressPatterns(db);

  console.log("Erector seed summary:", {
    modelVersions,
    threshold,
    archetypes,
    verdicts,
    vetoes,
    capabilities,
    patterns,
  });

  if (archetypes < 10) throw new Error(`erector_archetype_rule_packs: expected >= 10, got ${archetypes}`);
  if (verdicts < 14) throw new Error(`erector_verdict_rules active: expected >= 14, got ${verdicts}`);
  if (capabilities < 20) throw new Error(`erector_capability_graph: expected >= 20, got ${capabilities}`);
  if (patterns < 10) throw new Error(`erector_false_progress_patterns: expected >= 10, got ${patterns}`);
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
const runAsCli = process.argv[1]?.replace(/\\/g, "/").includes("erector-seed");
if (runAsCli) {
  const verifyOnly = process.argv.includes("--verify-only");
  const { db, pool } = await import("./index.js");
  try {
    if (!verifyOnly) await seedErectorCatalog(db);
    const ok = await verifyErectorSchema(db);
    if (!ok) process.exit(1);
    console.log(verifyOnly ? "Erector schema verification passed." : "Erector seed + verification passed.");
  } finally {
    await pool.end();
  }
}
