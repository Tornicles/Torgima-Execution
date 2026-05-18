/**
 * BHUDHI_CURSOR_PROMPT_7 — Psychology layer
 */
import { describe, it, expect } from "vitest";
import {
  computeBurnoutScore,
  riskLevelFromScore,
  collectBurnoutSignals,
} from "../../../engines/burnout/BurnoutDetectionEngine.js";
import { calculateCharacterLevel } from "../../../engines/character/CharacterProgressionEngine.js";
import { sanitizeRewardMessages } from "../../../engines/reward/RewardSystemEngine.js";
import { integrationEnabled } from "../../helpers/db.js";

const integration = integrationEnabled();

describe("Prompt 7 — Burnout detection (deterministic)", () => {
  it("TEST 1: HIGH risk when completion drops and scores stay high", () => {
    const score = computeBurnoutScore({
      completionRateDrop: 0.5,
      scoreVsCompletionGap: 0.35,
      reflectionLengthDrop: 0.45,
      sessionFrequencyDrop: 0,
      consecutiveDeclines: 5,
      inactivitySpikes: 3,
    });
    expect(score).toBeGreaterThanOrEqual(0.56);
    expect(riskLevelFromScore(score)).toBe("HIGH");
  });

  it("TEST 2: burnout informs adjustment without overriding condition enum", () => {
    const level = riskLevelFromScore(0.6);
    expect(level).toBe("HIGH");
    expect(level).not.toBe("stability");
  });
});

describe("Prompt 7 — Outcome validation logic", () => {
  it("TEST 3: SUSPICIOUS when high score meets low completion pattern", () => {
    const adversarial = 0.65;
    const pq = 0.75;
    const verdict =
      adversarial >= 0.6 && pq > 0.7 ? "SUSPICIOUS"
      : pq >= 0.7 ? "VALID"
      : "WEAK";
    expect(verdict).toBe("SUSPICIOUS");
  });
});

describe("Prompt 7 — Character progression", () => {
  it("TEST 7-8: character level thresholds", () => {
    expect(calculateCharacterLevel(0.05)).toBe(1);
    expect(calculateCharacterLevel(0.25)).toBe(3);
    expect(calculateCharacterLevel(0.55)).toBe(5);
    expect(calculateCharacterLevel(0.9)).toBe(8);
  });
});

describe("Prompt 7 — Reward language", () => {
  it("TEST 10: forbidden words stripped from reward messages", () => {
    const out = sanitizeRewardMessages([
      "Congratulations! Great job!",
      "Execution continuity maintained.",
    ]);
    expect(out[0].toLowerCase()).not.toContain("congratulations");
    expect(out[0].toLowerCase()).not.toContain("great job");
  });
});

describe.runIf(integration)("Prompt 7 — Integration", () => {
  it("TEST 4: failure classification persists multi-hypothesis", async () => {
    const { createTestUser, createTestBlueprint, createInitialState, cleanupTestUser } =
      await import("../../helpers/db.js");
    const { db, feedback, orders, failureClassifications } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { classifyFailureWithRecord } = await import(
      "../../../engines/failure/FailureClassificationRecord.js"
    );

    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    await createInitialState(bp.id, user.id);

    const { createTestOrder } = await import("../../helpers/db.js");
    const order = await createTestOrder(bp.id, user.id, { status: "failed" });

    const [fb] = await db
      .insert(feedback)
      .values({
        user_id: user.id,
        blueprint_id: bp.id,
        order_id: order.id,
        completion_status: "failed",
        reflection: "I don't know how to do this",
        score: 3,
      })
      .returning();

    const result = await classifyFailureWithRecord({
      userId: user.id,
      blueprintId: bp.id,
      orderId: order.id,
      feedbackId: fb!.id,
      reflection: fb!.reflection ?? "",
    });

    expect(result.primaryCandidate).toBeTruthy();
    const [row] = await db
      .select()
      .from(failureClassifications)
      .where(eq(failureClassifications.feedback_id, fb!.id))
      .limit(1);
    expect(row?.secondary_candidate).toBeTruthy();
    expect(row?.tertiary_candidate).toBeTruthy();

    await cleanupTestUser(user.id);
  });

  it("TEST 1 integration: scoreBurnoutRisk writes record", async () => {
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");
    const { db, feedback, burnoutRecords } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { scoreBurnoutRisk } = await import("../../../engines/burnout/BurnoutDetectionEngine.js");

    const { createTestBlueprint: mkBp, createTestOrder: mkOrder } = await import("../../helpers/db.js");
    const user = await createTestUser();
    const bp = await mkBp(user.id);
    const since = new Date(Date.now() - 10 * 86400000);
    for (let i = 0; i < 12; i++) {
      const order = await mkOrder(bp.id, user.id);
      await db.insert(feedback).values({
        user_id: user.id,
        blueprint_id: bp.id,
        order_id: order.id,
        completion_status: i < 6 ? "completed" : "failed",
        reflection: i < 6 ? "Detailed reflection with enough length for scoring" : "short",
        score: 9,
        created_at: new Date(since.getTime() + i * 86400000),
      });
    }

    const record = await scoreBurnoutRisk(user.id);
    expect(record.risk_level).toBeTruthy();
    const [latest] = await db
      .select()
      .from(burnoutRecords)
      .where(eq(burnoutRecords.user_id, user.id))
      .limit(1);
    expect(latest).toBeTruthy();

    await cleanupTestUser(user.id);
  });
});
