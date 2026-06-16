/**
 * DOC 36 — full execution loop (onboarding → first task → feedback → next task).
 */
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  orders,
  feedback,
  signalSnapshots,
  conditions,
  conditionRecords,
  enforcementPackages,
  rewardEvents,
  events,
  blueprints,
} from "@workspace/db";
import { BlueprintEngine } from "../../engines/blueprint/BlueprintEngine.js";
import { ValidationService } from "../../services/ValidationService.js";
import { BlueprintLaunchService } from "../../services/BlueprintLaunchService.js";
import { structureGoalDeterministic } from "../../engines/validation/ValidationEngine.js";
import { processFeedback } from "../../engines/feedback/FeedbackProcessingEngine.js";
import { calculate } from "../../engines/signal/SignalCalculationEngine.js";
import { evaluate } from "../../engines/condition/ConditionEvaluationEngine.js";
import { generateEnforcementPackage } from "../../engines/control/ControlEngine.js";
import { generate } from "../../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask } from "../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { enterLoop } from "../../engines/execution-loop/ExecutionLoopEngine.js";
import { evaluateReward } from "../../engines/reward/RewardEngine.js";
import { DashboardService } from "../../services/DashboardService.js";
import { DOC36_LOOP_BUDGET_MS } from "./doc36-constants.js";

export type Doc36LoopResult = {
  userId: string;
  blueprintId: string;
  firstOrderId: string;
  nextOrderId: string;
  feedbackId: string;
  elapsedMs: number;
};

async function runPostFeedbackPipeline(blueprintId: string, userId: string) {
  const sig = await calculate({ blueprintId, userId });
  const ev = await evaluate({
    blueprintId,
    userId,
    signalSnapshotId: sig.snapshotId,
    assignedCondition: sig.condition,
  });
  await generateEnforcementPackage({
    blueprintId,
    userId,
    conditionId: ev.conditionId,
    condition: ev.condition,
    signalSnapshotId: sig.snapshotId,
    escalationLevel: ev.escalationLevel,
    recoveryRequired: ev.recoveryRequired,
  });
  await generate({
    blueprintId,
    userId,
    generationMode: "post_feedback",
    generationTrigger: "feedback_submitted",
  });
  return guaranteeTask({
    blueprintId,
    userId,
    generationMode: "post_feedback",
    generationTrigger: "feedback_submitted",
  });
}

export async function runDoc36FullLoop(userId: string): Promise<Doc36LoopResult> {
  const t0 = Date.now();
  const structured = structureGoalDeterministic({
    rawGoal: "Launch a SaaS with 100 paying customers in 90 days",
    purpose: "Replace employment income",
    timeframe: "90 days",
    commitmentLevel: "high",
    currentContext: "Developer with savings",
    successSignal: "100 customers at $50/mo",
    knownBlockers: "No audience yet",
  });
  if (structured.validationVerdict === "INVALID") {
    throw new Error("DOC36: structured goal invalid");
  }

  const engine = new BlueprintEngine();
  const draft = await engine.createDraft(userId, {
    goal: structured.cleanedGoal,
    purpose: structured.purpose,
    commitmentLevel: "high",
  });
  const blueprintId = draft.blueprintId;

  const validation = await ValidationService.validateGoal({
    blueprintId,
    userId,
    tier: "starter",
    mode: "individual",
    input: {
      goal: structured.cleanedGoal,
      purpose: structured.purpose,
      timeframe: structured.timeframe,
      commitmentLevel: structured.commitmentLevel,
      currentContext: structured.currentContext,
      successSignal: structured.successSignals[0],
      knownBlockers: structured.blockers[0],
    },
  });
  if (!validation.validationContractId) throw new Error("DOC36: validation contract missing");

  const selectedPathType = validation.verdict === "adjust" ? "adjusted" : "current";
  await ValidationService.prepareForBlueprintLaunch({
    blueprintId,
    userId,
    validationId: validation.validationId,
    validationContractId: validation.validationContractId,
    selectedPathType,
    confirmAdjusted: selectedPathType === "adjusted",
  });

  await BlueprintLaunchService.launch({
    blueprintId,
    userId,
    validationContractId: validation.validationContractId,
    selectedPathType,
    selectedBlueprintLevel: "starter",
  });

  const firstGu = await guaranteeTask({
    blueprintId,
    userId,
    generationMode: "initial",
    generationTrigger: "blueprint_launched",
  });
  const firstOrderId = firstGu.orderId;
  if (!firstOrderId) throw new Error("DOC36: first task not guaranteed within budget");

  const dash1 = await DashboardService.getDashboardState(userId);
  const action1 = dash1.currentAction as { orderId?: string; id?: string } | null | undefined;
  const dashOrderId = action1?.orderId ?? action1?.id;
  if (!dashOrderId && Date.now() - t0 > DOC36_LOOP_BUDGET_MS) {
    throw new Error("DOC36: dashboard currentAction null after launch");
  }

  await db
    .update(orders)
    .set({ status: "active", started_at: new Date() })
    .where(eq(orders.id, firstOrderId));

  const fb = await processFeedback({
    orderId: firstOrderId,
    userId,
    blueprintId,
    completionStatus: "completed",
    score: 8,
    reflection:
      "Completed the first execution task with documented proof and a clear outcome for the loop test.",
    idempotencyKey: `doc36-loop-${userId}-${Date.now()}`,
  });
  if (!fb.feedbackId) throw new Error("DOC36: feedback not accepted");

  await enterLoop({
    blueprintId,
    userId,
    trigger: "feedback_submitted",
    generationMode: "post_feedback",
    causationEventId: fb.eventId || undefined,
  });

  const [bpRow] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  await evaluateReward({
    userId,
    blueprintId,
    sourceType: "FEEDBACK",
    sourceId: fb.feedbackId,
    idempotencyKey: `doc36-reward-${fb.feedbackId}`,
    stateVersion: bpRow?.state_version ?? 1,
    sourceEventId: fb.eventId,
  });

  const gu = await runPostFeedbackPipeline(blueprintId, userId);
  const nextOrderId = gu.orderId;
  if (!nextOrderId || nextOrderId === firstOrderId) {
    throw new Error("DOC36: next task not available after feedback");
  }

  const elapsedMs = Date.now() - t0;
  if (elapsedMs > DOC36_LOOP_BUDGET_MS) {
    throw new Error(`DOC36: loop exceeded ${DOC36_LOOP_BUDGET_MS}ms (${elapsedMs}ms)`);
  }

  return {
    userId,
    blueprintId,
    firstOrderId,
    nextOrderId,
    feedbackId: fb.feedbackId,
    elapsedMs,
  };
}

export type Doc36DbLoopChecks = {
  signalSnapshots: number;
  conditions: number;
  conditionRecords: number;
  enforcementPackages: number;
  completionReward: boolean;
  feedbackPresent: boolean;
};

export async function collectDoc36PostLoopDbState(
  blueprintId: string,
  feedbackId: string,
): Promise<Doc36DbLoopChecks> {
  const [{ sigCount }] = await db
    .select({ sigCount: sql<number>`count(*)::int` })
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));

  const [{ condCount }] = await db
    .select({ condCount: sql<number>`count(*)::int` })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

  const [{ condRecCount }] = await db
    .select({ condRecCount: sql<number>`count(*)::int` })
    .from(conditionRecords)
    .where(eq(conditionRecords.blueprint_id, blueprintId));

  const [{ enfCount }] = await db
    .select({ enfCount: sql<number>`count(*)::int` })
    .from(enforcementPackages)
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));

  const [reward] = await db
    .select({ id: rewardEvents.id })
    .from(rewardEvents)
    .where(and(eq(rewardEvents.blueprint_id, blueprintId), eq(rewardEvents.reward_type, "COMPLETION")))
    .orderBy(desc(rewardEvents.created_at))
    .limit(1);

  const [fbRow] = await db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, feedbackId)).limit(1);

  return {
    signalSnapshots: sigCount ?? 0,
    conditions: condCount ?? 0,
    conditionRecords: condRecCount ?? 0,
    enforcementPackages: enfCount ?? 0,
    completionReward: Boolean(reward?.id),
    feedbackPresent: Boolean(fbRow?.id),
  };
}

export async function collectDoc36GlobalIntegrity(): Promise<{
  pendingEvents: number;
  orphanedOrders: number;
  criticalHealthLogs: number;
  unreviewedDeadLetters: number;
}> {
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(events)
    .where(sql`lower(${events.status}) = 'pending' AND ${events.process_after} < NOW()`);

  const sample = await db
    .select({ blueprint_id: orders.blueprint_id })
    .from(orders)
    .limit(200);
  const bpIds = new Set(
    (await db.select({ id: blueprints.id }).from(blueprints)).map((b) => b.id),
  );
  const orphanedOrders = sample.filter((o) => o.blueprint_id && !bpIds.has(o.blueprint_id)).length;

  const healthResult = await db.execute(sql`
    SELECT COUNT(*)::int AS critical_health
    FROM system_health_logs
    WHERE status = 'critical' AND created_at > NOW() - INTERVAL '1 hour'
  `);
  const criticalHealth = Number((healthResult.rows[0] as { critical_health?: number })?.critical_health ?? 0);

  const dlqResult = await db.execute(sql`
    SELECT COUNT(*)::int AS unreviewed_dlq
    FROM dead_letter_events
    WHERE reviewed = false
  `);
  const unreviewedDlq = Number((dlqResult.rows[0] as { unreviewed_dlq?: number })?.unreviewed_dlq ?? 0);

  return {
    pendingEvents: pending ?? 0,
    orphanedOrders,
    criticalHealthLogs: criticalHealth,
    unreviewedDeadLetters: unreviewedDlq,
  };
}
