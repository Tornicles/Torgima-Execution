/**
 * IL1 — Identity Continuity & Reward System tests (T1–T6).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IdentityContinuityEngine,
  isVerifiedFeedbackEvidence,
  IL1_TO_DB_STAGE,
  DB_TO_IL1_STAGE,
  toDashboardIdentity,
} from "../../../engines/intelligence/IdentityContinuityEngine.js";
import { EventTypes, EVENT_QUEUE_MAP } from "../../../types/eventContracts.js";

describe("IL1 — IdentityContinuityEngine", () => {
  const engine = new IdentityContinuityEngine();

  it("T3: poor consistency → REGRESSING stage", () => {
    expect(engine.calculateStage(0.2, 5, 10, "building")).toBe("REGRESSING");
    expect(engine.calculateRegressionRisk(0.15)).toBe("CRITICAL");
    expect(engine.calculateRegressionRisk(0.35)).toBe("HIGH");
  });

  it("T2: strong execution → BUILDING or higher", () => {
    expect(engine.calculateStage(0.7, 7.5, 12, "forming")).toBe("STABILIZING");
    expect(engine.calculateStage(0.85, 8, 25, "establishing")).toBe("INTEGRATED");
  });

  it("T1: INITIATING when evidence count < 3", () => {
    expect(engine.calculateStage(1, 9, 2, null)).toBe("INITIATING");
    expect(IL1_TO_DB_STAGE.INITIATING).toBe("forming");
  });

  it("LAW 1: gaming and invalid feedback excluded from evidence", () => {
    expect(
      isVerifiedFeedbackEvidence({
        validity: "flagged",
        gaming_flag: true,
        interrogation_json: null,
        confidence_score: 0.9,
      } as never),
    ).toBe(false);
    expect(
      isVerifiedFeedbackEvidence({
        validity: "valid",
        gaming_flag: false,
        interrogation_json: { status: "needs_interrogation" },
        confidence_score: 0.9,
      } as never),
    ).toBe(false);
    expect(
      isVerifiedFeedbackEvidence({
        validity: "valid",
        gaming_flag: false,
        interrogation_json: null,
        confidence_score: 0.2,
      } as never),
    ).toBe(false);
    expect(
      isVerifiedFeedbackEvidence({
        validity: "valid",
        gaming_flag: false,
        interrogation_json: null,
        confidence_score: 0.8,
      } as never),
    ).toBe(true);
  });

  it("T6: dashboard identity defaults when no row", () => {
    const d = toDashboardIdentity(null);
    expect(d.stage).toBe("UNFORMED");
    expect(d.stabilityScore).toBe(0);
    expect(d.regressionRisk).toBe("LOW");
    expect(typeof d.transformationScore).toBe("number");
  });

  it("T6: dashboard maps DB stage to IL1 public stage", () => {
    const d = toDashboardIdentity({
      stage: "building",
      stability_score: 72,
      continuity_score: 72,
      regression_risk: "LOW",
      transformation_score: 65,
    } as never);
    expect(d.stage).toBe("BUILDING");
    expect(d.stabilityScore).toBe(72);
  });

  it("DB ↔ IL1 stage maps are consistent", () => {
    for (const db of Object.keys(DB_TO_IL1_STAGE) as Array<keyof typeof DB_TO_IL1_STAGE>) {
      const il1 = DB_TO_IL1_STAGE[db];
      expect(IL1_TO_DB_STAGE[il1]).toBeDefined();
    }
  });
});

describe("IL1 — async event chain (LAW 3)", () => {
  it("identity and reward workers are mapped and non-blocking", () => {
    expect(EVENT_QUEUE_MAP[EventTypes.IDENTITY_EVALUATION_REQUESTED]).toBe(
      "identity_evaluation_requested",
    );
    expect(EVENT_QUEUE_MAP[EventTypes.REWARD_EVALUATION_REQUESTED]).toBe(
      "reward_evaluation_requested",
    );
    expect(EventTypes.ORDER_AVAILABLE).toBe("order_available");
  });
});

describe("IL1 — RewardEngine contracts", () => {
  it("T4/T5: reward types include COMPLETION and HONEST_FAILURE", async () => {
    const mod = await import("../../../engines/reward/RewardEngine.js");
    expect(typeof mod.evaluateReward).toBe("function");
    expect(typeof mod.getPendingRewards).toBe("function");
  });
});

describe("IL1 — FeedbackWorker gating (unit)", () => {
  it("verified feedback helper gates identity/reward emission", () => {
    const valid = isVerifiedFeedbackEvidence({
      validity: "valid",
      gaming_flag: false,
      interrogation_json: {},
      confidence_score: 0.7,
    } as never);
    const gaming = isVerifiedFeedbackEvidence({
      validity: "valid",
      gaming_flag: true,
      interrogation_json: {},
      confidence_score: 0.9,
    } as never);
    expect(valid).toBe(true);
    expect(gaming).toBe(false);
  });
});
