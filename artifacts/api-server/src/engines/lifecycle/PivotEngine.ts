import {
  db,
  blueprints,
  targets,
  orders,
  pivotReviews,
  signalSnapshots,
  conditions,
  blueprintVersions,
  blueprintMutations,
} from "@workspace/db";
import { eq, and, ne, inArray, desc, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEventInTx, writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { TorgimaError } from "../../lib/errors.js";
import { CONDITIONS } from "../../constants/conditions.js";
import { deactivateBlueprintBhudhiMemory } from "../../bhudhi/MemoryService.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const INCOMPLETE_TARGET_STATUSES = ["pending", "active", "on_track", "at_risk"] as const;

export async function createPivotReview(params: {
  blueprintId: string;
  userId: string;
  triggerType: "automatic" | "manual";
  triggerReason: string;
}): Promise<string> {
  const [signal] = await db
    .select({ id: signalSnapshots.id })
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, params.blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);

  const [conditionRow] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const [review] = await db
    .insert(pivotReviews)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      trigger_type: params.triggerType,
      trigger_reason: params.triggerReason,
      signal_snapshot_id: signal?.id ?? null,
      condition_at_trigger: conditionRow?.condition ?? null,
      status: "open",
      path_options_json: [],
    })
    .returning({ id: pivotReviews.id });

  if (!review) throw new TorgimaError("INTERNAL_ERROR", "Failed to create pivot review", false);

  logger.info(
    {
      reviewId: review.id,
      blueprintId: params.blueprintId,
      triggerType: params.triggerType,
      triggerReason: params.triggerReason,
    },
    "[PivotEngine] Pivot review created",
  );

  return review.id;
}

export async function resolvePivotReview(params: {
  reviewId: string;
  blueprintId: string;
  userId: string;
  selectedPath: "continue" | "adjust" | "pivot";
}): Promise<void> {
  const [review] = await db
    .select()
    .from(pivotReviews)
    .where(
      and(
        eq(pivotReviews.id, params.reviewId),
        eq(pivotReviews.blueprint_id, params.blueprintId),
        eq(pivotReviews.user_id, params.userId),
      ),
    )
    .limit(1);

  if (!review || review.status !== "open") {
    throw new TorgimaError("NOT_FOUND", "Open pivot review not found", false);
  }

  const now = new Date();

  switch (params.selectedPath) {
    case "continue":
      await handleContinue(params.blueprintId, params.userId, now);
      break;
    case "adjust":
      await handleAdjust(params.blueprintId, params.userId, now);
      break;
    case "pivot":
      await handlePivot(params.blueprintId, params.userId, now);
      break;
  }

  await db
    .update(pivotReviews)
    .set({
      status: "resolved",
      selected_path: params.selectedPath,
      resolved_at: now,
    })
    .where(eq(pivotReviews.id, params.reviewId));

  logger.info(
    { reviewId: params.reviewId, blueprintId: params.blueprintId, selectedPath: params.selectedPath },
    "[PivotEngine] Pivot review resolved",
  );
}

async function handleContinue(blueprintId: string, userId: string, now: Date): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { generation_mode: "post_feedback", generation_trigger: "pivot_continue" },
    idempotencyKey: `pivot_continue:${blueprintId}:${now.getTime()}`,
  });
}

async function nextBlueprintVersionNumber(tx: Tx, blueprintId: string): Promise<number> {
  const [bp] = await tx
    .select({ version: blueprints.version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const [last] = await tx
    .select({ vn: blueprintVersions.version_number })
    .from(blueprintVersions)
    .where(eq(blueprintVersions.blueprint_id, blueprintId))
    .orderBy(desc(blueprintVersions.version_number))
    .limit(1);

  const base = Math.max(bp?.version ?? 1, last?.vn ?? 0);
  return base + 1;
}

async function handleAdjust(blueprintId: string, userId: string, now: Date): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [prevCond] = await tx
      .select({ condition: conditions.condition })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .limit(1);

    await tx
      .update(targets)
      .set({ status: "pending" })
      .where(
        and(eq(targets.blueprint_id, blueprintId), inArray(targets.status, [...INCOMPLETE_TARGET_STATUSES])),
      );

    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.status, "pending")));

    const vn = await nextBlueprintVersionNumber(tx, blueprintId);

    const [sig] = await tx
      .select({ id: signalSnapshots.id })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1);

    await tx.insert(blueprintVersions).values({
      blueprint_id: blueprintId,
      version_number: vn,
      change_type: "pivot_adjust",
      affected_layer: "blueprint",
      before_state: {},
      after_state: { summary: "Blueprint adjusted via pivot review", pivot_review: true },
      framework_source: null,
      triggered_by: userId,
    });

    await tx.insert(blueprintMutations).values({
      blueprint_id: blueprintId,
      mutation_type: "UPDATE",
      layer: "blueprint",
      entity_id: blueprintId,
      change_summary: "Pivot adjust: same goal, restructured approach",
      cascade_json: [],
      approved: true,
      approved_at: now,
    });

    await tx
      .update(conditions)
      .set({ is_current: false, exited_at: now })
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

    await tx.insert(conditions).values({
      blueprint_id: blueprintId,
      user_id: userId,
      condition: CONDITIONS.POWER_CHANGE,
      signal_snapshot_id: sig?.id ?? null,
      duration_days: 0,
      escalation_level: 0,
      recovery_required: true,
      transition_reason: "pivot_adjust",
      previous_condition: prevCond?.condition ?? null,
      is_current: true,
      entered_at: now,
    });

    await tx
      .update(blueprints)
      .set({
        version: vn,
        current_condition: CONDITIONS.POWER_CHANGE,
        state_version: sql`${blueprints.state_version} + 1`,
      })
      .where(eq(blueprints.id, blueprintId));

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.BLUEPRINT_ADJUSTED,
        entityType: "blueprint",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: { adjustment_type: "pivot_adjust" },
        idempotencyKey: `blueprint_adjusted:${blueprintId}:${now.getTime()}`,
      },
      tx,
    );

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
        entityType: "blueprint",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: { generation_mode: "recovery", generation_trigger: "pivot_adjust" },
        idempotencyKey: `task_gen_adjust:${blueprintId}:${now.getTime()}`,
      },
      tx,
    );
  });
}

async function handlePivot(blueprintId: string, userId: string, now: Date): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    await tx
      .update(targets)
      .set({ status: "skipped" })
      .where(and(eq(targets.blueprint_id, blueprintId), ne(targets.status, "complete")));

    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.status, "pending")));

    const vn = await nextBlueprintVersionNumber(tx, blueprintId);

    await tx.insert(blueprintVersions).values({
      blueprint_id: blueprintId,
      version_number: vn,
      change_type: "pivot_full",
      affected_layer: "blueprint",
      before_state: {},
      after_state: { summary: "Blueprint pivoted — new direction", pivot_review: true },
      framework_source: null,
      triggered_by: userId,
    });

    await tx.insert(blueprintMutations).values({
      blueprint_id: blueprintId,
      mutation_type: "UPDATE",
      layer: "blueprint",
      entity_id: blueprintId,
      change_summary: "Pivot: direction changed, structure archived",
      cascade_json: [],
      approved: true,
      approved_at: now,
    });

    await tx
      .update(signalSnapshots)
      .set({ is_current: false })
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));

    const windowStart = new Date(now.getTime() - 7 * 86400000);
    await tx.insert(signalSnapshots).values({
      blueprint_id: blueprintId,
      user_id: userId,
      window_start: windowStart,
      window_end: now,
      completion_rate: 0,
      weighted_score: 0,
      momentum: 0,
      trend: "stable",
      confidence: "insufficient_data",
      assigned_condition: CONDITIONS.NOTHINGNESS,
      is_current: true,
    });

    await tx
      .update(conditions)
      .set({ is_current: false, exited_at: now })
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

    await tx.insert(conditions).values({
      blueprint_id: blueprintId,
      user_id: userId,
      condition: CONDITIONS.NOTHINGNESS,
      duration_days: 0,
      escalation_level: 0,
      recovery_required: false,
      transition_reason: "pivot_full",
      is_current: true,
      entered_at: now,
    });

    await tx
      .update(blueprints)
      .set({
        version: vn,
        current_condition: CONDITIONS.NOTHINGNESS,
        state_version: sql`${blueprints.state_version} + 1`,
      })
      .where(eq(blueprints.id, blueprintId));

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.BLUEPRINT_PIVOTED,
        entityType: "blueprint",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: { pivot_type: "full_direction_change" },
        idempotencyKey: `blueprint_pivoted:${blueprintId}:${now.getTime()}`,
      },
      tx,
    );

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
        entityType: "blueprint",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: { generation_mode: "recovery", generation_trigger: "pivot_full" },
        idempotencyKey: `task_gen_pivot:${blueprintId}:${now.getTime()}`,
      },
      tx,
    );
  });

  await deactivateBlueprintBhudhiMemory(userId, blueprintId).catch(() => null);
}

export async function dismissPivotReview(params: {
  reviewId: string;
  blueprintId: string;
  userId: string;
}): Promise<void> {
  const [review] = await db
    .select({ id: pivotReviews.id })
    .from(pivotReviews)
    .where(
      and(
        eq(pivotReviews.id, params.reviewId),
        eq(pivotReviews.blueprint_id, params.blueprintId),
        eq(pivotReviews.user_id, params.userId),
        eq(pivotReviews.status, "open"),
      ),
    )
    .limit(1);

  if (!review) {
    throw new TorgimaError("NOT_FOUND", "Open pivot review not found", false);
  }

  await db
    .update(pivotReviews)
    .set({ status: "dismissed", resolved_at: new Date() })
    .where(eq(pivotReviews.id, params.reviewId));

  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: { generation_mode: "post_feedback", generation_trigger: "pivot_dismissed" },
    idempotencyKey: `pivot_dismissed:${params.blueprintId}:${Date.now()}`,
  });

  await writeEvent({
    eventType: EVENT_TYPES.PIVOT_REVIEW_DISMISSED,
    entityType: "pivot_review",
    entityId: params.reviewId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {},
    idempotencyKey: `pivot_review_dismissed:${params.reviewId}:${Date.now()}`,
  }).catch(() => null);
}

export class PivotEngine {
  createPivotReview(p: Parameters<typeof createPivotReview>[0]) {
    return createPivotReview(p);
  }
  resolvePivotReview(p: Parameters<typeof resolvePivotReview>[0]) {
    return resolvePivotReview(p);
  }
  dismissPivotReview(p: Parameters<typeof dismissPivotReview>[0]) {
    return dismissPivotReview(p);
  }
}
