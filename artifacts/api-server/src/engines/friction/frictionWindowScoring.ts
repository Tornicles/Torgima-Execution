/**
 * Phase 5 / DOC 25 — 14-day friction map for task-type adaptation.
 */

import { db, feedback, orders } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { logger } from "../../lib/logger.js";

export const PHASE5_FRICTION_CATEGORIES = [
  "TASK_TYPE_FRICTION",
  "DIFFICULTY_FRICTION",
  "TIMING_FRICTION",
  "DOMAIN_FRICTION",
  "PROOF_FRICTION",
  "INSTRUCTION_FRICTION",
] as const;

export type Phase5FrictionCategory = (typeof PHASE5_FRICTION_CATEGORIES)[number];

export type FrictionMapEntry = {
  category: Phase5FrictionCategory;
  frictionScore: number;
  taskType?: string;
  domain?: string;
};

export type FrictionMap = Record<string, FrictionMapEntry>;

const WINDOW_DAYS = 14;
const STRONG_FRICTION_THRESHOLD = 1.0;
const DETECTED_THRESHOLD = 0.5;
const TASK_TYPE_AVOIDANCE_MIN = 3;

function isFailureStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "skipped" || status === "blocked";
}

export function computeFrictionScore(
  failureRateForType: number,
  overallFailureRate: number,
): number {
  if (overallFailureRate <= 0) return failureRateForType > 0 ? 1 : 0;
  return failureRateForType / overallFailureRate - 1.0;
}

export async function buildFrictionMap(params: {
  userId: string;
  blueprintId: string;
}): Promise<FrictionMap> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

  const rows = await db
    .select({
      completion_status: feedback.completion_status,
      friction_score: feedback.friction_score,
      validity: feedback.validity,
      order_id: feedback.order_id,
      task_type: orders.task_type,
      domain: orders.domain,
      proof_type: orders.proof_type,
      difficulty: orders.difficulty,
      created_at: feedback.created_at,
    })
    .from(feedback)
    .leftJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since),
      ),
    );

  const map: FrictionMap = {};
  if (rows.length === 0) return map;

  const overallFailures = rows.filter((r) => isFailureStatus(r.completion_status)).length;
  const overallFailureRate = overallFailures / rows.length;

  const byTaskType = new Map<string, typeof rows>();
  for (const row of rows) {
    const tt = row.task_type ?? "execution";
    const list = byTaskType.get(tt) ?? [];
    list.push(row);
    byTaskType.set(tt, list);
  }

  for (const [taskType, typeRows] of byTaskType) {
    const typeFailures = typeRows.filter((r) => isFailureStatus(r.completion_status)).length;
    const typeFailureRate = typeFailures / typeRows.length;
    const score = computeFrictionScore(typeFailureRate, overallFailureRate);

    if (typeFailures >= TASK_TYPE_AVOIDANCE_MIN && score > DETECTED_THRESHOLD) {
      map[taskType] = {
        category: "TASK_TYPE_FRICTION",
        frictionScore: score,
        taskType,
      };
    }
  }

  const easyOk = rows.filter(
    (r) => r.difficulty === "easy" || r.difficulty === "very_easy",
  );
  const modFail = rows.filter(
    (r) =>
      (r.difficulty === "moderate" || r.difficulty === "hard" || r.difficulty === "very_hard") &&
      isFailureStatus(r.completion_status),
  );
  if (easyOk.length >= 2 && modFail.length >= 2) {
    const score = computeFrictionScore(
      modFail.length / rows.length,
      overallFailureRate,
    );
    if (score > DETECTED_THRESHOLD) {
      map["__difficulty__"] = {
        category: "DIFFICULTY_FRICTION",
        frictionScore: score,
      };
    }
  }

  const proofRejected = rows.filter((r) => r.validity === "invalid").length;
  if (proofRejected >= 3) {
    const score = computeFrictionScore(proofRejected / rows.length, overallFailureRate);
    if (score > DETECTED_THRESHOLD) {
      map["__proof__"] = { category: "PROOF_FRICTION", frictionScore: score };
    }
  }

  return map;
}

export async function emitStrongFrictionAdaptations(params: {
  userId: string;
  blueprintId: string;
  frictionMap: FrictionMap;
}): Promise<void> {
  for (const [key, entry] of Object.entries(params.frictionMap)) {
    if (entry.frictionScore <= STRONG_FRICTION_THRESHOLD) continue;

    await writeEvent({
      eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        friction_category: entry.category,
        friction_score: entry.frictionScore,
        task_type: entry.taskType ?? key,
        target: "TaskGenerationEngine",
        adaptation: "reduce_task_type_weight",
      },
      idempotencyKey: `friction_strong:${params.blueprintId}:${entry.category}:${key}`,
    });

    logger.info(
      { blueprintId: params.blueprintId, entry },
      "[FrictionWindow] Strong friction — adaptation_requested",
    );
  }
}

/** Task types to deprioritize this generation cycle (not permanent elimination). */
export function highFrictionTaskTypes(frictionMap: FrictionMap): Set<string> {
  const out = new Set<string>();
  for (const [key, entry] of Object.entries(frictionMap)) {
    if (entry.category === "TASK_TYPE_FRICTION" && entry.frictionScore > DETECTED_THRESHOLD) {
      out.add(entry.taskType ?? key);
    }
  }
  return out;
}
