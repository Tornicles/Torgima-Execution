import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

const manualSql = readFileSync(
  join(root, "scripts/migrations/manual-20260603-railway-onboarding-validations-schema-repair.sql"),
  "utf8",
);

describe("Railway onboarding schema repair migration", () => {
  it("adds validations contract_id validation_kind payload_version", () => {
    expect(manualSql).toMatch(/validations ADD COLUMN IF NOT EXISTS contract_id/i);
    expect(manualSql).toMatch(/validations ADD COLUMN IF NOT EXISTS validation_kind/i);
    expect(manualSql).toMatch(/validations ADD COLUMN IF NOT EXISTS payload_version/i);
  });

  it("adds validations intelligence and readiness columns", () => {
    expect(manualSql).toMatch(/intelligence_payload/i);
    expect(manualSql).toMatch(/launch_blocked/i);
    expect(manualSql).toMatch(/readiness validation_readiness/i);
  });

  it("adds blueprints raw input and goal_final columns", () => {
    expect(manualSql).toMatch(/blueprints ADD COLUMN IF NOT EXISTS raw_goal_input/i);
    expect(manualSql).toMatch(/blueprints ADD COLUMN IF NOT EXISTS raw_purpose_input/i);
    expect(manualSql).toMatch(/blueprints ADD COLUMN IF NOT EXISTS raw_goal/i);
    expect(manualSql).toMatch(/blueprints ADD COLUMN IF NOT EXISTS goal_final/i);
    expect(manualSql).toMatch(/blueprints ADD COLUMN IF NOT EXISTS blueprint_config/i);
  });

  it("uses only additive IF NOT EXISTS alters", () => {
    expect(manualSql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
    expect(manualSql).not.toMatch(/RENAME\s+COLUMN/i);
  });
});
