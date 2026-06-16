import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ERECTOR SCHEMA 2 — Execution Intelligence", () => {
  const migration = readRepo("migrations/0044_erector_schema_2_execution_intelligence.sql");
  const seed = readRepo("migrations/0045_erector_schema_2_seed_data.sql");
  const drizzle = readRepo("lib/db/src/schema/erectorExecutionIntelligenceTables.ts");
  const tables = readRepo("lib/db/src/schema/tables.ts");

  const newTables = [
    "erector_capability_graph",
    "erector_capability_gaps",
    "erector_capability_profiles",
    "erector_phase_gates",
    "erector_false_progress_patterns",
    "erector_resimulation_runs",
  ];

  it("defines all 6 execution intelligence tables in migration 0044", () => {
    for (const table of newTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("extends DOC 02 tables with Schema 2 columns only", () => {
    expect(migration).toContain("academy_tasks ADD COLUMN IF NOT EXISTS capability_gap_id");
    expect(migration).toContain("academy_proof ADD COLUMN IF NOT EXISTS evidence_ledger_id");
    expect(migration).toContain("outcome_validations ADD COLUMN IF NOT EXISTS outcome_movement_score");
    expect(migration).toContain("false_progress_flags ADD COLUMN IF NOT EXISTS archetype_pattern");
    expect(tables).toContain("capability_gap_id");
    expect(tables).toContain("outcome_movement_score");
    expect(tables).toContain("false_progress_score");
  });

  it("references Schema 1 tables for phase gates and resimulation", () => {
    expect(migration).toContain("REFERENCES erector_correction_paths(id)");
    expect(migration).toContain("REFERENCES erector_simulation_runs(id)");
  });

  it("seeds capability graph and false progress patterns", () => {
    expect(seed).toContain("erector_capability_graph");
    expect(seed).toContain("CAP-customer-discovery-01");
    expect(seed).toContain("erector_false_progress_patterns");
    expect(seed).toContain("FP-saas-01");
    expect(seed).toContain("signups_without_transactions");
  });

  it("exports Drizzle tables for execution intelligence entities", () => {
    const exports = [
      "erectorCapabilityGraph",
      "erectorCapabilityGaps",
      "erectorCapabilityProfiles",
      "erectorPhaseGates",
      "erectorFalseProgressPatterns",
      "erectorResimulationRuns",
    ];
    for (const name of exports) {
      expect(drizzle).toContain(`export const ${name}`);
    }
  });
});
