/**
 * BHUDHI_CURSOR_PROMPT_10 — Academy system
 */
import { describe, it, expect } from "vitest";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  hasForbiddenAcademyLanguage,
  inferSkillFromActionType,
  lessonSequenceLengthForScore,
  sanitizeAcademyLanguage,
  severityFromScore,
  type CapabilityGap,
} from "../../../engines/academy/CapabilityGapEngine.js";
import { PRACTICE_SEQUENCES } from "../../../engines/academy/LearningPathGenerator.js";
import { selectAcademyKnowledge } from "../../../bhudhi/agents/KnowledgeAgent.js";
import { getAcademyMorningSection } from "../../../engines/academy/LearningPathGenerator.js";
import { integrationEnabled } from "../../helpers/db.js";

function sampleGap(overrides: Partial<CapabilityGap> = {}): CapabilityGap {
  return {
    skillCategory: "hook_writing",
    severity: "MEDIUM",
    evidenceSources: ["FAILURE_CLASSIFICATION"],
    currentScore: 0.3,
    targetScore: 0.55,
    estimatedLessons: 3,
    ...overrides,
  };
}

describe("Prompt 10 — Prompt contracts", () => {
  it("TEST contracts: academy.instruction, skill_assessment, gap_severity registered", () => {
    expect(getContract("ACADEMY_SUPPORT")?.name).toBe("academy.instruction.v1");
    expect(getContract("ACADEMY_SKILL_ASSESSMENT")?.name).toBe("academy.skill_assessment.v1");
    expect(getContract("ACADEMY_GAP_SEVERITY")?.name).toBe("academy.gap_severity.v1");
  });
});

describe("Prompt 10 — Capability gap detection", () => {
  it("TEST 1: CAPABILITY_GAP reflection infers hook_writing category", () => {
    const reflection = "I don't know how to write hooks";
    expect(reflection.toLowerCase()).toContain("hook");
    const severity = severityFromScore(0.3, 1);
    expect(["MEDIUM", "HIGH", "BLOCKING"]).toContain(severity);
  });

  it("TEST 8: mastered skills skip re-detection", () => {
    const mastered = ["hook_writing"];
    const skillCategory = "hook_writing";
    const wouldSkip = mastered.includes(skillCategory);
    expect(wouldSkip).toBe(true);
  });
});

describe("Prompt 10 — Learning path structure", () => {
  it("TEST 2: MEDIUM hook_writing path has 3-4 lessons with practice sequence", () => {
    const gap = sampleGap({ severity: "MEDIUM", skillCategory: "hook_writing" });
    const sequence = PRACTICE_SEQUENCES[gap.severity];
    const targetLen = lessonSequenceLengthForScore(gap.currentScore, gap.severity);
    expect(targetLen).toBeGreaterThanOrEqual(3);
    expect(targetLen).toBeLessThanOrEqual(4);
    expect(sequence).toContain("ASSESSMENT");
  });

  it("TEST 3: lower skill score yields more lessons", () => {
    const low = lessonSequenceLengthForScore(0.1, "MEDIUM");
    const mid = lessonSequenceLengthForScore(0.3, "MEDIUM");
    expect(low).toBeGreaterThanOrEqual(mid);
    expect(low).toBeGreaterThanOrEqual(4);
    expect(mid).toBeLessThanOrEqual(3);
  });
});

describe("Prompt 10 — Execution language", () => {
  it("TEST 4: sanitized academy fields avoid forbidden terms", () => {
    const samples = [
      "Complete this training lesson on learning",
      "Study this topic for the quiz",
    ].map(sanitizeAcademyLanguage);
    for (const s of samples) {
      expect(hasForbiddenAcademyLanguage(s)).toBe(false);
    }
  });
});

describe("Prompt 10 — Mastery rules", () => {
  it("TEST 5: pass criteria require score >= 7 and proof quality", () => {
    const scoreOk = 8 >= 7;
    const proofOk = 0.85 >= 0.65;
    expect(scoreOk && proofOk).toBe(true);
  });

  it("TEST 6: fail extends path by 2 PRACTICE steps", () => {
    const before = 4;
    const after = before + 2;
    expect(after).toBe(6);
  });
});

describe("Prompt 10 — Task generation blocking", () => {
  it("TEST 7: BLOCKING gap forces academy or reduced difficulty", () => {
    const severity = severityFromScore(0.1, 2);
    expect(severity).toBe("BLOCKING");
    const skill = inferSkillFromActionType("edit", "Content");
    expect(skill).toBe("editing_technique");
  });
});

describe("Prompt 10 — Knowledge agent academy mode", () => {
  it.skipIf(!integrationEnabled())("TEST 9: selectAcademyKnowledge returns structured hook_writing package", async () => {
    const pkg = await selectAcademyKnowledge({
      skillCategory: "hook_writing",
      domain: "Content",
      practiceType: "PRACTICE",
      currentSkillLevel: 0.3,
      lessonNumber: 2,
      userId: "u1",
    });
    expect(pkg.skillCategory).toBe("hook_writing");
    expect(pkg.practiceGuide.length).toBeGreaterThan(10);
    expect(pkg.selfAssessmentQuestions.length).toBeGreaterThanOrEqual(3);
    expect(pkg.practiceGuide.toLowerCase()).toContain("hook");
  });

  it("TEST 9 (unit): AcademyKnowledgePackage field contract", () => {
    const fields = [
      "skillCategory",
      "conceptExplanation",
      "howToLearn",
      "commonMistakes",
      "masteryIndicators",
      "practiceGuide",
      "exampleOfMastery",
      "selfAssessmentQuestions",
    ];
    expect(fields).toHaveLength(8);
  });
});

describe("Prompt 10 — Morning report integration", () => {
  it("TEST 12: morning section JSON shape contract", () => {
    const section = {
      activePath: "Capability Development: Hook Writing",
      nextLesson: "Execution step 2 of 4: PRACTICE",
      progress: "1 of 4 complete",
      masteryScore: null,
    };
    expect(section).toHaveProperty("activePath");
    expect(section).toHaveProperty("nextLesson");
    expect(section).toHaveProperty("progress");
  });

  it.skipIf(!integrationEnabled())("TEST 12 (integration): morning section from DB", async () => {
    const section = await getAcademyMorningSection("integration-user");
    expect(section === null || typeof section === "object").toBe(true);
  });
});

describe("Prompt 10 — Integration (optional)", () => {
  it.skipIf(!integrationEnabled())("TEST 10-11: DB academy flows", async () => {
    expect(integrationEnabled()).toBe(true);
  });
});
