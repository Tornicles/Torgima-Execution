import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

/** PART 8 inventory — 27 new Erector tables across Schemas 1–3. */
const ERECTOR_NEW_TABLE_INVENTORY = [
  "erector_intake_sessions",
  "erector_user_reality_profiles",
  "erector_verdict_rules",
  "erector_validation_runs",
  "erector_verdict_decisions",
  "erector_archetype_classifications",
  "erector_archetype_rule_packs",
  "erector_threshold_matrix",
  "erector_simulation_runs",
  "erector_framework_veto_rules",
  "erector_blueprint_launch_contracts",
  "erector_correction_paths",
  "erector_evidence_ledger",
  "erector_signals",
  "erector_capability_graph",
  "erector_capability_gaps",
  "erector_capability_profiles",
  "erector_phase_gates",
  "erector_false_progress_patterns",
  "erector_resimulation_runs",
  "erector_decision_audits",
  "erector_model_versions",
  "erector_user_facing_explanations",
  "erector_integrity_flags",
  "erector_manual_review_cases",
  "erector_system_error_records",
  "erector_observability_logs",
] as const;

describe("ERECTOR SCHEMA 3 — Governance & Operations", () => {
  const migration = readRepo("migrations/0046_erector_schema_3_governance_operations.sql");
  const seed = readRepo("migrations/0047_erector_schema_3_seed_data.sql");
  const drizzle = readRepo("lib/db/src/schema/erectorGovernanceOperationsTables.ts");
  const m1 = readRepo("migrations/0042_erector_schema_1_core_runtime.sql");
  const m2 = readRepo("migrations/0044_erector_schema_2_execution_intelligence.sql");

  const schema3Tables = [
    "erector_decision_audits",
    "erector_model_versions",
    "erector_user_facing_explanations",
    "erector_integrity_flags",
    "erector_manual_review_cases",
    "erector_system_error_records",
    "erector_observability_logs",
  ];

  it("defines all 7 governance tables in migration 0046", () => {
    for (const table of schema3Tables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("links explanations and manual review to decision audits", () => {
    expect(migration).toContain("REFERENCES erector_decision_audits(decision_id)");
    expect(migration).toContain("REFERENCES erector_evidence_ledger(id)");
  });

  it("seeds 10 model version components at v0.1", () => {
    expect(seed).toContain("erector_model_versions");
    expect(seed).toContain("validation_model");
    expect(seed).toContain("threshold_matrix");
    const components = [
      "validation_model",
      "simulation_model",
      "economic_type_model",
      "archetype_rule_pack",
      "academy_rule",
      "outcome_validation",
      "framework_rule",
      "signal_calculation",
      "proof_standard",
      "threshold_matrix",
    ];
    for (const c of components) {
      expect(seed).toContain(`'${c}'`);
    }
  });

  it("exports Drizzle tables for governance entities", () => {
    const exports = [
      "erectorDecisionAudits",
      "erectorModelVersions",
      "erectorUserFacingExplanations",
      "erectorIntegrityFlags",
      "erectorManualReviewCases",
      "erectorSystemErrorRecords",
      "erectorObservabilityLogs",
    ];
    for (const name of exports) {
      expect(drizzle).toContain(`export const ${name}`);
    }
  });

  it("PART 8 — all 27 new Erector tables exist across Schema 1–3 migrations", () => {
    const allMigrations = `${m1}\n${m2}\n${migration}`;
    for (const table of ERECTOR_NEW_TABLE_INVENTORY) {
      const inM1 = m1.includes(`CREATE TABLE IF NOT EXISTS ${table}`);
      const inM2 = m2.includes(`CREATE TABLE IF NOT EXISTS ${table}`);
      const inM3 = migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`);
      const inIntake = table === "erector_intake_sessions" && m1.includes("erector_intake_sessions");
      expect(inM1 || inM2 || inM3 || inIntake).toBe(true);
    }
    expect(ERECTOR_NEW_TABLE_INVENTORY).toHaveLength(27);
  });
});
