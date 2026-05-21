/**
 * PROMPT 2 — Erector Academy router, evaluation, retention curve.
 */

import { describe, it, expect } from "vitest";
import { SAMPLE_ACADEMY_COURSES } from "../../../engines/academy/academySampleCatalog.js";
import {
  routeAcademyRequest,
  evaluatePracticeAnswer,
  calculateRetentionCurve,
  calculateNextReviewDate,
} from "../../../engines/academy/ErectorAcademyEngine.js";
import { calculateLearningXp } from "../../../engines/academy/AcademyIntegrationEngine.js";

describe("Erector Academy catalog", () => {
  it("includes at least 5 sample courses", () => {
    expect(SAMPLE_ACADEMY_COURSES.length).toBeGreaterThanOrEqual(5);
    for (const c of SAMPLE_ACADEMY_COURSES) {
      expect(c.chapters.length).toBeGreaterThan(0);
      expect(c.chapters[0]!.lessons.length).toBeGreaterThan(0);
    }
  });
});

describe("Academy router", () => {
  it("routes teach_me to tutor engine", () => {
    const out = routeAcademyRequest({
      action: "teach_me",
      topic: "clarity",
      learningProfile: {
        learningStyle: "visual",
        pace: "normal",
        preferredFormats: ["text"],
        comprehensionSpeed: 1,
        retentionRate: 0.7,
        commonMistakes: [],
        strengths: [],
        weaknesses: [],
      },
    });
    expect(out.engine).toBe("tutor");
    expect(out.payload.learningStyle).toBe("visual");
  });

  it("routes quiz_me to practice engine", () => {
    const out = routeAcademyRequest({ action: "quiz_me" });
    expect(out.engine).toBe("practice");
  });
});

describe("Practice evaluation", () => {
  it("grades correct and incorrect answers", () => {
    const ok = evaluatePracticeAnswer({
      userAnswer: "b",
      correctAnswer: "b",
      explanation: "Because B.",
    });
    expect(ok.correct).toBe(true);
    expect(ok.score).toBe(100);

    const bad = evaluatePracticeAnswer({
      userAnswer: "a",
      correctAnswer: "b",
      explanation: "Because B.",
    });
    expect(bad.correct).toBe(false);
    expect(bad.correction).toContain("b");
  });
});

describe("Learning XP", () => {
  it("scales XP with mastery level", () => {
    expect(calculateLearningXp(95)).toBe(50);
    expect(calculateLearningXp(50)).toBe(15);
    expect(calculateLearningXp(10)).toBe(5);
  });
});

describe("Retention curve", () => {
  it("decays retention over time", () => {
    const day0 = calculateRetentionCurve(0, 2);
    const day7 = calculateRetentionCurve(7, 2);
    expect(day0).toBeGreaterThan(day7);
  });

  it("schedules sooner review for low mastery", () => {
    const soon = calculateNextReviewDate(30, new Date("2026-01-01"));
    const late = calculateNextReviewDate(95, new Date("2026-01-01"));
    expect(soon < late).toBe(true);
  });
});
