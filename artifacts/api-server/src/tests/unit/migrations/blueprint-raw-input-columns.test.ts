import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

describe("blueprint raw input migration", () => {
  const manualSql = readFileSync(
    join(root, "scripts/migrations/manual-20260602-blueprint-raw-goal-purpose-input.sql"),
    "utf8",
  );
  const drizzleSql = readFileSync(
    join(root, "migrations/0030_blueprint_raw_goal_purpose_input.sql"),
    "utf8",
  );

  it("manual migration adds raw_goal_input and raw_purpose_input", () => {
    expect(manualSql).toMatch(/ADD COLUMN IF NOT EXISTS raw_goal_input/i);
    expect(manualSql).toMatch(/ADD COLUMN IF NOT EXISTS raw_purpose_input/i);
  });

  it("drizzle migration mirrors blueprint input columns", () => {
    expect(drizzleSql).toMatch(/"raw_goal_input"/);
    expect(drizzleSql).toMatch(/"raw_purpose_input"/);
  });
});
