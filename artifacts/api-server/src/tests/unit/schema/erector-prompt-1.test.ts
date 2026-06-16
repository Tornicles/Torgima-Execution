import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CRITICAL_VERDICT_RULE_IDS } from "@workspace/db/erector-seed";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

const ERECTOR_MIGRATIONS = [
  "0041_erector_schema_addendum.sql",
  "0042_erector_schema_1_core_runtime.sql",
  "0043_erector_schema_1_seed_data.sql",
  "0044_erector_schema_2_execution_intelligence.sql",
  "0045_erector_schema_2_seed_data.sql",
  "0046_erector_schema_3_governance_operations.sql",
  "0047_erector_schema_3_seed_data.sql",
  "0048_erector_prompt_1_seed_alignment.sql",
] as const;

const PROMPT1_27_TABLES = [
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

describe("ERECTOR PROMPT 1 — Migrations, Seeds, Verification", () => {
  const tablesTs = readRepo("lib/db/src/schema/tables.ts");
  const schemaErector = readRepo("lib/db/src/schema-erector.ts");
  const erectorSeed = readRepo("lib/db/src/erector-seed.ts");
  const alignment = readRepo("migrations/0048_erector_prompt_1_seed_alignment.sql");
  const allSql = ERECTOR_MIGRATIONS.map((f) => readRepo(`migrations/${f}`)).join("\n");

  it("has all 8 Erector migration files registered", () => {
    const journal = readRepo("migrations/meta/_journal.json");
    for (const file of ERECTOR_MIGRATIONS) {
      const tag = file.replace(".sql", "");
      expect(journal).toContain(tag);
    }
  });

  it("schema-erector.ts re-exports all Erector schema modules", () => {
    expect(schemaErector).toContain("erectorTables");
    expect(schemaErector).toContain("erectorCoreRuntimeTables");
    expect(schemaErector).toContain("erectorExecutionIntelligenceTables");
    expect(schemaErector).toContain("erectorGovernanceOperationsTables");
  });

  it("extends DOC 02 tables with approved column additions only", () => {
    expect(allSql).toContain("dashboard_mode");
    expect(allSql).toContain("erector_state");
    expect(allSql).toContain("capability_gap_id");
    expect(allSql).toContain("evidence_ledger_id");
    expect(allSql).toContain("outcome_movement_score");
    expect(allSql).toContain("archetype_pattern");
    expect(tablesTs).toContain("capability_gap_id");
    expect(tablesTs).toContain("false_progress_score");
  });

  it("defines 27 core erector_ tables across migrations", () => {
    for (const table of PROMPT1_27_TABLES) {
      expect(allSql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}|CREATE TABLE ${table}`),
      );
    }
  });

  it("seeds meet Prompt 1 minimum counts in SQL files", () => {
    expect(allSql).toContain("erector_threshold_matrix");
    expect(allSql.match(/'starter'/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(allSql).toContain("marketplace_exchange");
    expect(allSql).toContain("VR-040");
    expect(allSql).toContain("strategy_core");
    expect(allSql).toContain("validation_model");
    expect(allSql).toContain("FP-saas-01");
    const capabilityInserts =
      (allSql.match(/CAP-/g) ?? []).length;
    expect(capabilityInserts).toBeGreaterThanOrEqual(20);
  });

  it("aligns critical verdict rule IDs in migration 0048", () => {
    for (const id of CRITICAL_VERDICT_RULE_IDS) {
      expect(alignment).toContain(`'${id}'`);
    }
  });

  it("erector-seed.ts exposes seed and verify functions", () => {
    expect(erectorSeed).toContain("seedErectorCatalog");
    expect(erectorSeed).toContain("verifyErectorSchema");
    expect(CRITICAL_VERDICT_RULE_IDS.length).toBe(14);
  });
});
