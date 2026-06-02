import {
  db,
  blueprints,
  conditions as conditionsTable,
  stateMemory,
  escalationLogs,
  signalSnapshots,
} from "@workspace/db";
import { eq, and, desc, gte, ne } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import {
  assertBlueprintVersion,
  getCurrentStateVersion,
  incrementStateVersion,
} from "../../services/StateMutationService.js";
import { isPowerChange } from "../signal/SignalCalculationEngine.js";
import type { SignalState } from "../../types/signal.js";
import type { Condition } from "../../constants/conditions.js";
import { CONDITION_RULES } from "../../constants/conditions.js";
import { dailyTasksForCondition } from "../../constants/conditionSpec.js";
import { ensureFrameworkSignalPlaceholders } from "../signals/FrameworkSignalPlaceholders.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── ESCALATION THRESHOLDS ─────────────────────────────────────────────────────
const ESCALATION_THRESHOLDS: Record<string, number[]> = {
  nothingness: [7, 14, 21],
  danger:      [3, 5, 7],
  urgency:     [5, 10],
  stability:   [],
  power:       [14],
  affluence:   [21, 30],
  power_change: [],
};

export interface ConditionEvaluationResult {
  conditionId: string;
  condition: string;
  previousCondition: string;
  conditionChanged: boolean;
  durationDays: number;
  escalationLevel: number;
  recoveryRequired: boolean;
  stateMemoryId: string;
}

// ── MAIN EVALUATION ───────────────────────────────────────────────────────────

export async function evaluate(params: {
  blueprintId: string;
  userId: string;
  signalSnapshotId: string;
  assignedCondition: string;
  causationEventId?: string;
}): Promise<ConditionEvaluationResult> {
  const now = new Date();
  await ensureFrameworkSignalPlaceholders(params.blueprintId).catch(() => null);
  const expectedStateVersion = await getCurrentStateVersion(params.blueprintId);

  const [currentCondition] = await db
    .select()
    .from(conditionsTable)
    .where(
      and(eq(conditionsTable.blueprint_id, params.blueprintId), eq(conditionsTable.is_current, true)),
    )
    .orderBy(desc(conditionsTable.entered_at))
    .limit(1);

  const previousConditionName = currentCondition?.condition ?? "nothingness";

  const assignedFromSignal = params.assignedCondition;

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [baselineSnap] = await db
    .select({ assigned_condition: signalSnapshots.assigned_condition })
    .from(signalSnapshots)
    .where(
      and(
        eq(signalSnapshots.blueprint_id, params.blueprintId),
        gte(signalSnapshots.created_at, twentyFourHoursAgo),
        ne(signalSnapshots.id, params.signalSnapshotId),
      ),
    )
    .orderBy(signalSnapshots.created_at)
    .limit(1);

  const baselineCondition =
    baselineSnap?.assigned_condition && baselineSnap.assigned_condition !== null
      ? baselineSnap.assigned_condition
      : previousConditionName;

  let finalCondition = assignedFromSignal;

  const swingRecent =
    isPowerChange(assignedFromSignal, baselineCondition) ||
    isPowerChange(assignedFromSignal, previousConditionName);

  if (
    swingRecent &&
    !["nothingness", "power_change"].includes(previousConditionName)
  ) {
    finalCondition = "power_change";
  }

  const { shouldHoldConditionForFatigue } = await import("./conditionFatigueHold.js");
  if (
    await shouldHoldConditionForFatigue({
      userId: params.userId,
      blueprintId: params.blueprintId,
      previousCondition: previousConditionName,
      proposedCondition: finalCondition,
    })
  ) {
    finalCondition = previousConditionName;
  }

  const conditionChanged = previousConditionName !== finalCondition;

  const prevEscalation = currentCondition?.escalation_level ?? 0;

  const { stateMemoryId, tenureDays, conditionId, escalationLevel, recoveryRequired } =
    await db.transaction(async (tx) => {
      const mem = await manageStateMemory(tx, {
        blueprintId: params.blueprintId,
        userId: params.userId,
        newCondition: finalCondition,
        conditionChanged,
        now,
      });

      const escalationLevelInner = computeEscalationLevel(finalCondition, mem.tenureDays);
      const recoveryRequiredInner =
        finalCondition === "danger" || escalationLevelInner >= 2;

      let idOut: string;

      if (conditionChanged) {
        if (currentCondition) {
          await tx
            .update(conditionsTable)
            .set({ is_current: false, exited_at: now })
            .where(eq(conditionsTable.id, currentCondition.id));
        }

        const [inserted] = await tx
          .insert(conditionsTable)
          .values({
            blueprint_id:       params.blueprintId,
            user_id:            params.userId,
            condition:          finalCondition as typeof conditionsTable.$inferInsert["condition"],
            signal_snapshot_id: params.signalSnapshotId,
            duration_days:      mem.tenureDays,
            escalation_level:   escalationLevelInner,
            recovery_required:  recoveryRequiredInner,
            previous_condition: previousConditionName as typeof conditionsTable.$inferInsert["previous_condition"],
            transition_reason:  `Signal → ${finalCondition} (was ${previousConditionName})`,
            is_current:         true,
            entered_at:         now,
          })
          .returning({ id: conditionsTable.id });

        if (!inserted) throw new Error("Failed to create condition record");
        idOut = inserted.id;
      } else if (currentCondition) {
        await tx
          .update(conditionsTable)
          .set({
            duration_days:      mem.tenureDays,
            escalation_level: escalationLevelInner,
            recovery_required:  recoveryRequiredInner,
            signal_snapshot_id: params.signalSnapshotId,
            transition_reason:  `Condition confirmed: ${finalCondition}`,
          })
          .where(eq(conditionsTable.id, currentCondition.id));
        idOut = currentCondition.id;
      } else {
        const [inserted] = await tx
          .insert(conditionsTable)
          .values({
            blueprint_id:       params.blueprintId,
            user_id:            params.userId,
            condition:          finalCondition as typeof conditionsTable.$inferInsert["condition"],
            signal_snapshot_id: params.signalSnapshotId,
            duration_days:      mem.tenureDays,
            escalation_level:   escalationLevelInner,
            recovery_required:  recoveryRequiredInner,
            previous_condition: previousConditionName as typeof conditionsTable.$inferInsert["previous_condition"],
            transition_reason:  `Initial condition: ${finalCondition}`,
            is_current:         true,
            entered_at:         now,
          })
          .returning({ id: conditionsTable.id });
        if (!inserted) throw new Error("Failed to create condition record");
        idOut = inserted.id;
      }

      await assertBlueprintVersion(tx, params.blueprintId, expectedStateVersion);

      await tx
        .update(blueprints)
        .set({ current_condition: finalCondition as typeof blueprints.$inferInsert["current_condition"] })
        .where(eq(blueprints.id, params.blueprintId));

      return {
        conditionId: idOut,
        stateMemoryId: mem.stateMemoryId,
        tenureDays: mem.tenureDays,
        escalationLevel: escalationLevelInner,
        recoveryRequired: recoveryRequiredInner,
      };
    });

  if (escalationLevel > prevEscalation && escalationLevel > 0) {
    await writeEscalationLog({
      blueprintId: params.blueprintId,
      userId: params.userId,
      condition: finalCondition,
      escalationLevel,
      durationDays: tenureDays,
    });
  }

  await incrementStateVersion(params.blueprintId, "condition_evaluated", params.causationEventId);

  if (conditionChanged) {
    const { traceConditionEvaluation } = await import(
      "../../services/DecisionTraceService.js"
    );
    await traceConditionEvaluation({
      blueprintId: params.blueprintId,
      userId: params.userId,
      previousCondition: previousConditionName,
      newCondition: finalCondition,
      escalationLevel,
      recoveryRequired,
      causationEventId: params.causationEventId,
    }).catch(() => undefined);
  }

  logger.info(
    {
      blueprintId: params.blueprintId,
      from: previousConditionName,
      to: finalCondition,
      changed: conditionChanged,
      duration: tenureDays,
      escalation: escalationLevel,
      recoveryNeeded: recoveryRequired,
    },
    "[ConditionEngine] Evaluation complete",
  );

  return {
    conditionId,
    condition: finalCondition,
    previousCondition: previousConditionName,
    conditionChanged,
    durationDays: tenureDays,
    escalationLevel,
    recoveryRequired,
    stateMemoryId,
  };
}

async function manageStateMemory(
  tx: Tx,
  params: {
    blueprintId: string;
    userId: string;
    newCondition: string;
    conditionChanged: boolean;
    now: Date;
  },
): Promise<{ stateMemoryId: string; tenureDays: number }> {
  const msPerDay = 24 * 60 * 60 * 1000;

  const [currentMemory] = await tx
    .select()
    .from(stateMemory)
    .where(and(eq(stateMemory.blueprint_id, params.blueprintId), eq(stateMemory.is_current, true)))
    .limit(1);

  if (params.conditionChanged) {
    if (currentMemory) {
      const prevTenure = Math.floor(
        (params.now.getTime() - currentMemory.entered_at.getTime()) / msPerDay,
      );
      await tx
        .update(stateMemory)
        .set({
          is_current: false,
          exited_at: params.now,
          duration_days: prevTenure,
        })
        .where(eq(stateMemory.id, currentMemory.id));
    }

    const [newMemory] = await tx
      .insert(stateMemory)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        condition: params.newCondition,
        entered_at: params.now,
        is_current: true,
        duration_days: 0,
        escalation_level: 0,
      })
      .returning({ id: stateMemory.id });

    if (!newMemory) throw new Error("Failed to open state_memory");
    return { stateMemoryId: newMemory.id, tenureDays: 0 };
  }

  if (currentMemory) {
    const tenureDays = Math.floor(
      (params.now.getTime() - currentMemory.entered_at.getTime()) / msPerDay,
    );
    await tx
      .update(stateMemory)
      .set({ duration_days: tenureDays, condition: params.newCondition })
      .where(eq(stateMemory.id, currentMemory.id));
    return { stateMemoryId: currentMemory.id, tenureDays };
  }

  const [newMemory] = await tx
    .insert(stateMemory)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      condition: params.newCondition,
      entered_at: params.now,
      is_current: true,
      duration_days: 0,
      escalation_level: 0,
    })
    .returning({ id: stateMemory.id });

  if (!newMemory) throw new Error("Failed to create state_memory");
  return { stateMemoryId: newMemory.id, tenureDays: 0 };
}

function computeEscalationLevel(condition: string, durationDays: number): number {
  const thresholds = ESCALATION_THRESHOLDS[condition] ?? [];
  let level = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (durationDays >= thresholds[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

async function writeEscalationLog(params: {
  blueprintId: string;
  userId: string;
  condition: string;
  escalationLevel: number;
  durationDays: number;
}): Promise<void> {
  await db
    .insert(escalationLogs)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      level: params.escalationLevel,
      condition: params.condition,
      trigger_reason: `${params.condition} persisted for ${params.durationDays} days — escalation level ${params.escalationLevel}`,
      payload: { duration_days: params.durationDays },
    })
    .catch(() => null);
}

export function getEscalationThresholds(): Record<string, number[]> {
  return ESCALATION_THRESHOLDS;
}

export class ConditionEvaluationEngine {
  evaluate(signals: SignalState): Condition {
    logger.info({ userId: signals.userId }, "[ConditionEvaluationEngine] evaluate — use evaluate() worker API");
    return signals.condition;
  }

  getAllowedTaskTypes(condition: Condition): string[] {
    return CONDITION_RULES[condition]?.allowedTypes ?? [];
  }

  getMaxDailyTasks(condition: Condition): number {
    return dailyTasksForCondition(condition);
  }
}
