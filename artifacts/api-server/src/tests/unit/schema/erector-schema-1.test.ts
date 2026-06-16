import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ERECTOR SCHEMA 1 — Core Runtime", () => {
  const migration = readRepo("migrations/0042_erector_schema_1_core_runtime.sql");
  const seed = readRepo("migrations/0043_erector_schema_1_seed_data.sql");
  const drizzle = readRepo("lib/db/src/schema/erectorCoreRuntimeTables.ts");

  const coreTables = [
    "erector_user_reality_profiles",
    "erector_verdict_rules",
    "erector_validation_runs",
    "erector_verdict_decisions",
    "erector_archetype_classifications",
    "erector_archetype_rule_packs",
    "erector_threshold_matrix",
    "erector_evidence_ledger",
    "erector_signals",
    "erector_simulation_runs",
    "erector_framework_veto_rules",
    "erector_blueprint_launch_contracts",
    "erector_correction_paths",
  ];

  it("defines all 13 core runtime tables in migration 0042", () => {
    for (const table of coreTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("extends users and blueprints with Schema 1 columns only", () => {
    expect(migration).toContain("dashboard_mode");
    expect(migration).toContain("erector_tier");
    expect(migration).toContain("erector_state");
    expect(migration).toContain("erector_simulation_id");
    expect(migration).toContain("erector_archetype");
    expect(migration).toContain("erector_launch_contract_id");
    expect(migration).toContain("blueprint_source");
  });

  it("extends erector_intake_sessions with normalization columns", () => {
    expect(migration).toContain("normalized_payload");
    expect(migration).toContain("validation_ready");
    expect(migration).toContain("blueprint_id");
  });

  it("seeds threshold matrix, archetypes, verdict rules, and framework vetoes", () => {
    expect(seed).toContain("erector_threshold_matrix");
    expect(seed).toContain("('starter', 60, 40, 39, 2)");
    expect(seed).toContain("erector_archetype_rule_packs");
    expect(seed).toContain("marketplace_exchange");
    expect(seed).toContain("erector_verdict_rules");
    expect(seed).toContain("VR-001");
    expect(seed).toContain("VR-040");
    expect(seed).toContain("erector_framework_veto_rules");
    expect(seed).toContain("strategy_core");
  });

  it("exports Drizzle tables for all core runtime entities", () => {
    const exports = [
      "erectorUserRealityProfiles",
      "erectorVerdictRules",
      "erectorValidationRuns",
      "erectorVerdictDecisions",
      "erectorArchetypeClassifications",
      "erectorArchetypeRulePacks",
      "erectorThresholdMatrix",
      "erectorEvidenceLedger",
      "erectorSignals",
      "erectorSimulationRuns",
      "erectorFrameworkVetoRules",
      "erectorBlueprintLaunchContracts",
      "erectorCorrectionPaths",
    ];
    for (const name of exports) {
      expect(drizzle).toContain(`export const ${name}`);
    }
  });
});
