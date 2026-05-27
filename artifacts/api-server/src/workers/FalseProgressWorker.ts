import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import {
  db,
  feedback,
  orders,
  targets,
  falseProgressFlags,
} from "@workspace/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { detectFalseProgress } from "../engines/intelligence/FalseProgressDetectionEngine.js";
import { validateOutcome } from "../engines/outcome/OutcomeValidationEngine.js";
import { WorkerQueues } from "../types/eventContracts.js";

export const FALSE_PROGRESS_QUEUE = WorkerQueues.FALSE_PROGRESS_SCAN;

async function scanBlueprintFalseProgress(
  userId: string,
  blueprintId: string,
): Promise<number> {
  const twoWeeks = new Date(Date.now() - 14 * 86400000);
  const recentFeedback = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.blueprint_id, blueprintId),
        eq(feedback.user_id, userId),
        gte(feedback.created_at, twoWeeks),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(20);

  const completionCount = recentFeedback.filter((f) => f.completion_status === "completed").length;
  const hasProof = recentFeedback.some(
    (f) => f.proof_json && Object.keys(f.proof_json as object).length > 0,
  );
  const avgScore =
    recentFeedback.length > 0
      ? recentFeedback.reduce((s, f) => s + (f.score ?? 0), 0) / recentFeedback.length
      : 0;
  const evidenceScore = hasProof ? 50 : avgScore >= 7 ? 35 : 15;

  const completedOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), inArray(orders.status, ["completed", "complete"])))
    .limit(10);

  let outcomeMovementScore = 0;
  const [target] = await db
    .select({ progress: targets.progress })
    .from(targets)
    .where(and(eq(targets.blueprint_id, blueprintId), eq(targets.status, "active")))
    .limit(1);
  if (target?.progress != null && target.progress > 0) {
    outcomeMovementScore = Math.min(100, target.progress);
  }

  const fp = detectFalseProgress({
    completionCount,
    evidenceScore,
    outcomeMovementScore,
    hasProof,
    avgScore,
  });

  if (!fp.detected || !fp.pattern) return 0;

  const [existing] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
        eq(falseProgressFlags.detection_type, fp.pattern),
      ),
    )
    .limit(1);

  if (existing) return 0;

  await db.insert(falseProgressFlags).values({
    user_id: userId,
    blueprint_id: blueprintId,
    detection_type: fp.pattern,
    severity: completionCount >= 8 ? "high" : "medium",
    status: "active",
    resolved: false,
    evidence_json: {
      completion_count: completionCount,
      evidence_score: evidenceScore,
      outcome_movement_score: outcomeMovementScore,
      correction_task_type: fp.correctionTaskType,
    },
  });

  if (recentFeedback[0]) {
    await validateOutcome({
      userId,
      blueprintId,
      sourceType: "false_progress_scan",
      sourceId: recentFeedback[0].id,
    }).catch(() => null);
  }

  return 1;
}

workerRegistry.register({
  name: "FalseProgressWorker",
  queue: FALSE_PROGRESS_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 3 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "FalseProgressWorker", async (data) => {
        const { userId, blueprintId } = data;
        if (!userId || !blueprintId) {
          return { success: false, retryable: false, reason: "Missing userId or blueprintId" };
        }

        const created = await scanBlueprintFalseProgress(userId, blueprintId);
        logger.info({ blueprintId, flagsCreated: created }, "[FalseProgressWorker] Scan complete");
        return { success: true };
      });
    }
  },
});
