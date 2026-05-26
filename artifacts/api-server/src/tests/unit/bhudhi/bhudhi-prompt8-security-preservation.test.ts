import { describe, it, expect } from "vitest";
import {
  evaluateRecommendationChecks,
  isCompliantSystemType,
  encryptDataBase64,
  decryptDataBase64,
  MAX_BUDGET_IMPACT,
  MAX_RISK_PROBABILITY,
} from "../../../bhudhi/security/securityLogic.js";
import {
  computeOutcomeAccuracy,
  extractLearningsFromEvents,
  buildDomainExpertiseFromEvents,
  testHypothesisStats,
} from "../../../bhudhi/preservation/preservationLogic.js";
import { preservationService } from "../../../bhudhi/preservation/PreservationService.js";
import { securityService } from "../../../bhudhi/security/SecurityService.js";

describe("BHUDHI PROMPT 8 — Security", () => {
  it("accepts compliant system types", () => {
    expect(isCompliantSystemType("crm")).toBe(true);
    expect(isCompliantSystemType("hrms")).toBe(true);
    expect(isCompliantSystemType("unknown_erp")).toBe(false);
  });

  it("validates recommendation when all checks pass", () => {
    const result = evaluateRecommendationChecks(
      {
        expectedRevenue: 50_000,
        riskProbability: 0.3,
        adoptionLikelihood: 0.8,
        strategicallyAligned: true,
      },
      true,
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags budget, risk, adoption, alignment, and compliance violations", () => {
    const result = evaluateRecommendationChecks(
      {
        expectedRevenue: MAX_BUDGET_IMPACT + 1,
        riskProbability: MAX_RISK_PROBABILITY + 0.1,
        adoptionLikelihood: 0.2,
        strategicallyAligned: false,
      },
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(5);
  });

  it("encrypts and decrypts data via base64", () => {
    const payload = { apiKey: "secret", scope: ["read"] };
    const encrypted = securityService.encryptData(payload);
    expect(encryptDataBase64(payload)).toBe(encrypted);
    expect(securityService.decryptData(encrypted)).toEqual(payload);
    expect(decryptDataBase64("not-valid-base64!!!")).toBeNull();
  });
});

describe("BHUDHI PROMPT 8 — Preservation", () => {
  it("computes outcome accuracy from actual vs expected", () => {
    expect(computeOutcomeAccuracy(0.9, 1)).toBeCloseTo(0.9, 2);
    expect(computeOutcomeAccuracy(0.5, 0.5)).toBe(1);
  });

  it("extracts learnings from execution event patterns", () => {
    const manyCompleted = Array.from({ length: 25 }, (_, i) => ({
      event_type: "task_completed",
      description: `Task ${i} done`,
      data: { status: "completed" },
      learnings_generated: ["a", "b"],
      frameworks_improved: [`fw${i % 6}`],
    }));

    const learnings = extractLearningsFromEvents(manyCompleted);
    expect(learnings).toContain("High success rate indicates execution excellence");
    expect(learnings.some((l) => l.includes("frameworks improved"))).toBe(true);
  });

  it("builds domain expertise levels from event volume", () => {
    const novice = buildDomainExpertiseFromEvents(
      Array.from({ length: 5 }, () => ({
        event_type: "task_completed",
        description: "genesis work",
        data: {},
        learnings_generated: [],
        frameworks_improved: [],
      })),
    );
    expect(novice.expertise_level).toBe("novice");

    const expert = buildDomainExpertiseFromEvents(
      Array.from({ length: 55 }, (_, i) => ({
        event_type: "task_completed",
        description: `growth pattern ${i % 12}`,
        data: {},
        learnings_generated: [],
        frameworks_improved: [],
      })),
    );
    expect(expert.expertise_level).toBe("expert");
    expect(expert.patternsDiscovered).toBeGreaterThan(10);
  });

  it("tests hypothesis with significance flag", () => {
    const strong = preservationService.testHypothesis("Scale ads", 10, 25);
    expect(strong.effectSize).toBe(15);
    expect(strong.significant).toBe(true);
    expect(strong.confidence).toBe("High");

    const weak = testHypothesisStats("Minor tweak", 10, 10.5);
    expect(weak.significant).toBe(false);
    expect(weak.confidence).toBe("Low");
  });
});
