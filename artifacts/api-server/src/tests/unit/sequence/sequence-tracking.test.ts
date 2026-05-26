/**
 * Blueprint sequence tracking — schema + flow definitions.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BlueprintSequenceName,
  flowPathForTier,
  totalSequencesForTier,
} from "../../../types/blueprintSequences.js";

const root = resolve(process.cwd(), "../..");

describe("Blueprint sequence specification", () => {
  it("defines tier-specific flow paths", () => {
    expect(flowPathForTier("starter")[0]).toBe(BlueprintSequenceName.GOAL);
    expect(flowPathForTier("starter")).toContain(BlueprintSequenceName.VALIDATION);
    expect(totalSequencesForTier("starter")).toBe(flowPathForTier("starter").length);
    expect(flowPathForTier("growth")).toContain(BlueprintSequenceName.ADAPTATION);
    expect(flowPathForTier("ultimate")).toContain(BlueprintSequenceName.PREDICTION);
  });

  it("migration creates all sequence tables", () => {
    const sql = readFileSync(
      resolve(root, "scripts/migrations/manual-20260522-blueprint-sequence-tracking.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS blueprint_sequences");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS sequence_flows");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS prediction_scene_sequences");
  });

  it("exports sequence tables from db schema", () => {
    const index = readFileSync(resolve(root, "lib/db/src/schema/index.ts"), "utf8");
    expect(index).toContain("sequenceTables");
  });
});
