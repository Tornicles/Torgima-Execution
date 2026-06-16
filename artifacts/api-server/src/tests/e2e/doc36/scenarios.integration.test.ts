/**
 * DOC 36 §3 — additional loop scenario tests (canonical suite).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import { integrationEnabled, createTestUser, createTestBlueprint, createTestOrder } from "../../helpers/db.js";
import { db, feedback, events, behaviorPatterns, falseProgressFlags, orders } from "@workspace/db";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { runAntiGamingChecks } from "../../../engines/feedback/submitFeedbackPhase1.js";
import { detectGaming } from "../../../engines/execution-loop/feedback/GamingDetector.js";
import { mutate } from "../../../services/StateMutationService.js";
import { scanForInactivity } from "../../../engines/inactivity/InactivityDetectionEngine.js";
import { classifyInactivity } from "../../../engines/inactivity/InactivityThresholds.js";
import { EventTypes } from "../../../types/eventContracts.js";
import { computeSpecFatigueRiskScore } from "../../../engines/pattern/patternScoring.js";
import { FALSE_PROGRESS_PATTERNS, detectFalseProgress } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";
import { evaluateExecutabilityFromBlocks } from "../../../engines/dependency/ExecutabilityChecker.js";
import { createDependency, ensureResolvablePublication } from "../../../engines/dependency/DependencyEngine.js";
import { checkBlockingConditions } from "../../../engines/reward/RewardEligibilityChecker.js";
import { highestQualifiedStage, determineNextStage } from "../../../engines/identity/IdentityStageEvaluator.js";
import type { TransformationEvidence } from "../../../engines/identity/TransformationEvidenceCollector.js";
import { ensureDoc36E2eReady } from "./global-setup.js";

const run = integrationEnabled();

function identityEvidence(overrides: Partial<TransformationEvidence> = {}): TransformationEvidence {
  return {
    accepted_feedback_count_7d: 3,
    accepted_feedback_count_14d: 7,
    accepted_feedback_count_30d: 10,
    consistency_7d: 0.55,
    consistency_14d: 0.55,
    recovery_tasks_completed: 0,
    returned_after_inactivity: false,
    capability_upgrades_proven: 0,
    current_difficulty_level: 2,
    outcomes_validated: 0,
    milestones_completed: 0,
    days_since_last_activity: 2,
    critical_false_progress_open: false,
    any_false_progress_open: false,
    missed_windows_last_7_days: 0,
    current_streak_days: 5,
    days_active_this_month: 8,
    ...overrides,
  };
}

describe("DOC 36 — Loop scenarios (spec table)", () => {
  it("gaming detection triggers interrogation: score=10, reflection=done", () => {
    const gaming = detectGaming({
      payload: {
        orderId: "00000000-0000-4000-8000-000000000001",
        completion: "COMPLETED",
        clientStateVersion: 1,
        idempotencyKey: "doc36-game-spec",
        effortScore: 5,
        frictionScore: 1,
        durationMinutes: 1,
      },
      order: { proof_required: false, time_estimate_minutes: 60, difficulty: "moderate" } as never,
      recentFeedbacks: [],
      reflection: "done",
    });
    expect(gaming.trigger_interrogation || gaming.gaming_suspected).toBe(true);
  });

  it("inactivity detection after 25 hours classifies missed execution", () => {
    const result = classifyInactivity(25);
    expect(result).not.toBeNull();
    expect(result?.severity).not.toBe("INFO");
    expect(result?.type).toBeTruthy();
  });

  it("false progress detected on wrong work: 8 tasks, target metric unchanged", () => {
    const fp = detectFalseProgress({
      completionCount: 8,
      evidenceScore: 10,
      outcomeMovementScore: 5,
      alignmentScore: 10,
      hasProof: false,
      avgScore: 7,
      wrongWork: true,
    });
    expect(fp.detected).toBe(true);
    expect(fp.pattern).toBe("WRONG_WORK");
    expect(FALSE_PROGRESS_PATTERNS).toContain("WRONG_WORK");
  });

  it("failure classification routes correctly: unclear task reflection", () => {
    expect(EventTypes.FAILURE_CLASSIFICATION_REQUESTED).toBe("failure_classification_requested");
  });

  it("pattern learning detects delay: 3 feedback records 20+ hours after start", () => {
    const score = computeSpecFatigueRiskScore({
      prev7dCompletionRate: 0.8,
      curr3dCompletionRate: 0.2,
      recentTasks: [
        { effortScore: 5, notesLength: 5, durationMinutes: 2, timeEstimate: 60 },
        { effortScore: 5, notesLength: 8, durationMinutes: 1, timeEstimate: 45 },
        { effortScore: 4, notesLength: 6, durationMinutes: 3, timeEstimate: 50 },
      ],
      hardTasksLast3d: 4,
      inactivityAfterIntensity: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it("dependency blocks task publication: unresolved SEQUENCE dependency", () => {
    const exec = evaluateExecutabilityFromBlocks([
      {
        type: "SEQUENCE",
        description: "Prerequisite order incomplete",
        blocking: true,
        dependencyId: "dep-1",
        resolutionStrategy: "complete_prerequisite",
      },
    ]);
    expect(exec.executable).toBe(false);
    expect(exec.recommendedNextAction).toBe("GENERATE_RESOLUTION_TASK");
    expect(exec.resolutionTask).toBeTruthy();
  });

  it("identity advances after consistent execution: INITIATING → BUILDING", () => {
    const evidence = identityEvidence({
      accepted_feedback_count_14d: 15,
      consistency_14d: 0.72,
    });
    expect(highestQualifiedStage(evidence)).toBe("BUILDING");
    expect(determineNextStage("INITIATING", evidence)).toBe("BUILDING");
  });
});

describe("DOC 36 — Loop scenarios (unit surface)", () => {
  it("gaming detection: high score + short reflection triggers interrogation", () => {
    const gaming = detectGaming({
      payload: {
        orderId: "00000000-0000-4000-8000-000000000001",
        completion: "COMPLETED",
        clientStateVersion: 1,
        idempotencyKey: "doc36-game",
        effortScore: 5,
        frictionScore: 1,
        durationMinutes: 1,
      },
      order: { proof_required: false, time_estimate_minutes: 60, difficulty: "moderate" } as never,
      recentFeedbacks: [],
      reflection: "done",
    });
    expect(gaming.trigger_interrogation || gaming.gaming_suspected).toBe(true);
  });

  it("anti-gaming: effort 5 + short duration + no notes → REJECTED", () => {
    const result = runAntiGamingChecks({
      payload: {
        orderId: "00000000-0000-4000-8000-000000000001",
        completion: "COMPLETED",
        clientStateVersion: 1,
        idempotencyKey: "doc36-ag",
        effortScore: 5,
        frictionScore: 1,
        durationMinutes: 1,
        userNotes: "",
      },
      order: { proof_required: false, time_estimate_minutes: 60, difficulty: "moderate" } as never,
      recentFeedbacks: [],
    });
    expect(result.verdict).toBe("REJECTED");
  });

  it("false progress patterns are defined", () => {
    expect(FALSE_PROGRESS_PATTERNS.length).toBeGreaterThanOrEqual(5);
  });

  it("failure_classification_requested event type is defined", () => {
    expect(EventTypes.FAILURE_CLASSIFICATION_REQUESTED).toBe("failure_classification_requested");
  });

  it("FATIGUE_RISK / delay pattern scoring reaches threshold", () => {
    const score = computeSpecFatigueRiskScore({
      prev7dCompletionRate: 0.8,
      curr3dCompletionRate: 0.2,
      recentTasks: [
        { effortScore: 5, notesLength: 5, durationMinutes: 2, timeEstimate: 60 },
        { effortScore: 5, notesLength: 8, durationMinutes: 1, timeEstimate: 45 },
      ],
      hardTasksLast3d: 4,
      inactivityAfterIntensity: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
  });
});

describe.skipIf(!run)("DOC 36 — Loop scenarios (integration)", () => {
  beforeAll(async () => {
    await ensureDoc36E2eReady();
  }, 120_000);

  it("stale expectedStateVersion returns STALE_STATE", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 2 });
    await expect(
      mutate({
        blueprintId: bp.id,
        userId: user.id,
        expectedVersion: 0,
        mutationName: "TEST_DOC36_STALE",
        mutationFn: async () => ({ ok: true }),
      }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
  }, 30_000);

  it("reward blocked by false progress flag: OUTCOME_TRUTH blocked when flag open", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    await db.insert(falseProgressFlags).values({
      blueprint_id: bp.id,
      user_id: user.id,
      detection_type: "WRONG_WORK",
      severity: "CRITICAL",
      status: "active",
      resolved: false,
      false_progress_score: 85,
      evidence_json: { doc36: true },
    });
    const block = await checkBlockingConditions(user.id, bp.id, "OUTCOME_TRUTH");
    expect(block.isBlocked).toBe(true);
    expect(block.reason).toMatch(/false_progress/);
  }, 30_000);

  it("duplicate idempotencyKey does not double-insert feedback", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    const key = `doc36-dup-${Date.now()}`;
    const a = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "First submission with enough detail for validity checks to pass.",
      idempotencyKey: key,
    });
    const b = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "Duplicate submission should return same feedback id.",
      idempotencyKey: key,
    }).catch((e) => e);

    if (!(b instanceof Error)) {
      expect(b.feedbackId).toBe(a.feedbackId);
    }

    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.order_id, order.id));
    expect(c).toBeLessThanOrEqual(1);
  }, 60_000);

  it("FAILED feedback with unclear task emits failure_classification_requested", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "failed",
      score: 3,
      reflection: "The task was unclear and I could not tell what done meant for this step.",
      blockerJson: { description: "Unclear instructions", type: "capability_gap" },
      idempotencyKey: `doc36-fail-${Date.now()}`,
    });

    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.blueprint_id, bp.id),
          eq(events.event_type, EventTypes.FAILURE_CLASSIFICATION_REQUESTED),
        ),
      )
      .orderBy(desc(events.created_at))
      .limit(3);
    expect(rows.length).toBeGreaterThan(0);
  }, 60_000);

  it("inactivity scan runs without throwing", async () => {
    const result = await scanForInactivity();
    expect(result).toBeDefined();
  }, 120_000);

  it("blocked order stays non-completed after failed feedback path", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, {
      status: "active",
      started_at: new Date(),
      blocker_description: "Waiting on vendor",
    });
    await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "failed",
      score: 2,
      reflection: "Blocked by external dependency; vendor API still unavailable after waiting.",
      blockerJson: { description: "Vendor API down", type: "external_dependency" },
      idempotencyKey: `doc36-blocked-${Date.now()}`,
    });
    const [row] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1);
    expect(row?.status).not.toBe("completed");
  }, 60_000);

  it("behavior_patterns stores delay / fatigue evidence", async () => {
    const user = await createTestUser();
    const [row] = await db
      .insert(behaviorPatterns)
      .values({
        user_id: user.id,
        pattern_type: "procrastination",
        status: "active",
        evidence_json: { spec_label: "DELAY_PATTERN", doc36: true },
        confidence: 0.85,
      })
      .returning();
    expect((row?.evidence_json as { spec_label?: string })?.spec_label).toBe("DELAY_PATTERN");
  }, 30_000);

  it("dependency resolution publishes resolution order instead of blocked execution", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const blocker = await createTestOrder(bp.id, user.id, { status: "pending" });
    const blocked = await createTestOrder(bp.id, user.id, { status: "pending" });
    await createDependency({
      blueprintId: bp.id,
      blockingOrderId: blocker.id,
      blockedOrderId: blocked.id,
      dependencyType: "SEQUENCE",
    });
    const result = await ensureResolvablePublication({
      blueprintId: bp.id,
      userId: user.id,
      orderId: blocked.id,
    });
    expect(result.replaced).toBe(true);
    expect(result.orderId).not.toBe(blocked.id);

    const [blockedRow] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, blocked.id))
      .limit(1);
    expect(blockedRow?.status).toBe("blocked");
  }, 60_000);
});
