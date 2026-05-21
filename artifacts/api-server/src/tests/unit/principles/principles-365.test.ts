/**
 * PROMPT 1 — 365 Principles: catalog, proof validation, scoring, feature flag.
 */

import { describe, it, expect } from "vitest";
import {
  buildPrincipleCatalog,
  scorePrincipleForCondition,
} from "../../../engines/principles/principlesCatalog.js";
import {
  PROOF_TYPES,
  validateProofSubmission,
  dayOfYear,
  todayDateString,
  mapPrincipleRow,
} from "../../../engines/principles/Principles365Engine.js";
import {
  FEATURE_FLAGS,
  isFeatureEnabledByDefault,
} from "../../../constants/feature-flags.js";

describe("365 Principles catalog", () => {
  it("builds exactly 365 unique day numbers", () => {
    const catalog = buildPrincipleCatalog();
    expect(catalog).toHaveLength(365);
    const days = new Set(catalog.map((p) => p.dayNumber));
    expect(days.size).toBe(365);
    expect(Math.min(...catalog.map((p) => p.dayNumber))).toBe(1);
    expect(Math.max(...catalog.map((p) => p.dayNumber))).toBe(365);
  });

  it("each principle has statement, rules, and keywords", () => {
    const catalog = buildPrincipleCatalog();
    for (const p of catalog) {
      expect(p.principleStatement.length).toBeGreaterThan(10);
      expect(p.principleRules.length).toBeGreaterThanOrEqual(4);
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(p.managementVolumeSource).toContain("Management Volume");
    }
  });

  it("scores higher when keywords match condition", () => {
    const catalog = buildPrincipleCatalog();
    const dangerPrinciple = catalog.find((p) =>
      p.keywords.some((k) => k === "danger" || p.principleStatement.toLowerCase().includes("recovery")),
    );
    expect(dangerPrinciple).toBeDefined();
    const base = scorePrincipleForCondition(["unrelated"], "danger", "");
    const boosted = scorePrincipleForCondition(dangerPrinciple!.keywords, "danger", "blocked");
    expect(boosted).toBeGreaterThanOrEqual(base);
  });
});

describe("365 Principles proof validation", () => {
  it("rejects invalid proof types", () => {
    expect(() =>
      validateProofSubmission({
        proofType: "emoji",
        applicationDescription: "Applied to order #1",
      }),
    ).toThrow(/Invalid proofType/);
  });

  it("requires applicationDescription", () => {
    expect(() =>
      validateProofSubmission({
        proofType: "screenshot",
        applicationDescription: "   ",
      }),
    ).toThrow(/applicationDescription/);
  });

  it("requires text body for text and reflection proofs", () => {
    expect(() =>
      validateProofSubmission({
        proofType: "text",
        proofContent: {},
        applicationDescription: "Done",
      }),
    ).toThrow(/proofContent.text/);

    expect(() =>
      validateProofSubmission({
        proofType: "reflection",
        proofContent: { reflection: "  " },
        applicationDescription: "Done",
      }),
    ).toThrow(/proofContent.text/);

    expect(() =>
      validateProofSubmission({
        proofType: "reflection",
        proofContent: { reflection: "Closed the loop on today's blocker." },
        applicationDescription: "Applied clarity law",
      }),
    ).not.toThrow();
  });

  it("exports six proof types", () => {
    expect(PROOF_TYPES).toEqual([
      "screenshot",
      "video",
      "voice",
      "photo",
      "text",
      "reflection",
    ]);
  });
});

describe("365 Principles utilities", () => {
  it("todayDateString is ISO date", () => {
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dayOfYear is between 1 and 366", () => {
    const d = dayOfYear(new Date("2026-01-15"));
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(366);
  });

  it("mapPrincipleRow maps DB shape to API shape", () => {
    const mapped = mapPrincipleRow({
      id: "p-1",
      day_number: 42,
      principle_statement: "Test law",
      principle_rules: ["rule a"],
      philosophy: "why",
      tension_points: "drift",
      management_volume_source: "MV-42",
      keywords: ["focus"],
      created_at: new Date(),
      updated_at: new Date(),
    } as never);
    expect(mapped.dayNumber).toBe(42);
    expect(mapped.statement).toBe("Test law");
    expect(mapped.rules).toEqual(["rule a"]);
  });
});

describe("365 Principles feature flag", () => {
  it("principles_365_enabled is on by default in phase 1", () => {
    expect(FEATURE_FLAGS.PRINCIPLES_365_ENABLED).toBe("principles_365_enabled");
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.PRINCIPLES_365_ENABLED)).toBe(true);
  });
});
