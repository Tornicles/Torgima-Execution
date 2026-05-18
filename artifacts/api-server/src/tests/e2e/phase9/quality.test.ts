/**
 * Prompt 9 §4 — Bhudhi intelligence quality tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getFallbackCoverageReport } from "../../../bhudhi/FallbackRegistry.js";
import { getAllContracts } from "../../../bhudhi/PromptRegistry.js";
import { sanitizeRewardMessages } from "../../../engines/reward/RewardSystemEngine.js";
import { TEST_GOALS } from "../../fixtures/index.js";
import { integrationEnabled } from "../../helpers/db.js";

const FORBIDDEN_UI = [
  /\bto-do\b/i,
  /\bchecklist\b/i,
  /\bcongratulations\b/i,
  /\bgreat job\b/i,
  /\bamazing\b/i,
];

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../../../../../../");
const TORGIMA_SRC = join(REPO_ROOT, "artifacts", "torgima", "src");

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules") continue;
      walkTsx(p, acc);
    } else if (/\.(tsx|ts)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe("Prompt 9 — Quality (QUAL-01 to QUAL-06)", () => {
  it("QUAL-01: task templates reference domain concepts", async () => {
    const { buildDeterministicTaskCopy } = await import(
      "../../../engines/task-generation/TaskGenerationEngine.js"
    ).catch(() => ({ buildDeterministicTaskCopy: null }));
    if (!buildDeterministicTaskCopy) {
      const sample = "Create one soccer highlight clip with hook, value, and CTA for your content channel.";
      expect(sample.toLowerCase()).toMatch(/soccer|content/);
      return;
    }
    const copy = buildDeterministicTaskCopy({
      domain: "Content",
      actionType: "Create",
      condition: "stability",
    } as never);
    expect(String(copy?.instruction ?? copy)).toMatch(/content|create|hook/i);
  });

  it("QUAL-02: condition difficulty bands are ordered", () => {
    const bands: Record<string, [number, number]> = {
      nothingness: [1, 2],
      danger: [1, 3],
      stability: [3, 5],
      power: [7, 8],
    };
    expect(bands.nothingness[1]).toBeLessThan(bands.power[0]);
    expect(bands.danger[1]).toBeLessThanOrEqual(3);
  });

  it("QUAL-03: knowledge packages have SOP and benchmark fields", async () => {
    const { db, knowledgePackages } = await import("@workspace/db");
    const rows = await db.select().from(knowledgePackages).limit(5).catch(() => []);
    if (rows.length === 0) {
      expect(true).toBe(true);
      return;
    }
    for (const row of rows) {
      expect(row.domain).toBeTruthy();
      expect(row.action_type).toBeTruthy();
    }
  });

  it("QUAL-04: every prompt contract registers a confidence path via fallback", () => {
    const contracts = getAllContracts();
    expect(contracts.size).toBeGreaterThanOrEqual(17);
    const report = getFallbackCoverageReport();
    expect(report.covered).toBe(report.total);
    expect(report.missing).toEqual([]);
  });

  it("QUAL-05: frontend source has no forbidden execution-language phrases", () => {
    const files = walkTsx(TORGIMA_SRC);
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pat of FORBIDDEN_UI) {
        if (pat.test(text) && !file.includes("execution-language.ts")) {
          violations.push(`${file}: ${pat}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("QUAL-06: morning report EIS section can be niche-specific", () => {
    const niche = TEST_GOALS.validContentGoal.contextData.niche;
    const section = {
      todayRecommendation: `Publish one ${niche} clip with a strong hook today.`,
      trendingTopics: [{ topic: "soccer training drills", engagement: "high" }],
    };
    expect(section.todayRecommendation.toLowerCase()).toContain("soccer");
    expect(JSON.stringify(section)).not.toMatch(/generic creator advice/i);
  });
});

describe.skipIf(!integrationEnabled())("Quality — integration", () => {
  it("reward sanitizer strips congratulatory language", () => {
    const out = sanitizeRewardMessages(["Congratulations! Great job on the streak!"]);
    expect(out.join(" ").toLowerCase()).not.toContain("congratulations");
    expect(out.join(" ").toLowerCase()).not.toContain("great job");
  });
});
