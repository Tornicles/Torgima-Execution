import {
  db,
  blueprints,
  conditions,
  enforcementPackages,
  signalSnapshots,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import {
  frameworkSignalsRecord,
  getConditionDisplaySpec,
  metricsToFrameworkSignals,
  normalizeFrameworkSignals,
} from "../engines/condition/ConditionDeterminationEngine.js";
import type { SignalMetrics } from "../engines/signal/SignalCalculationEngine.types.js";
import { readPermanentFrameworkSignals } from "./PermanentFrameworkSignalService.js";

async function resolveBlueprintId(
  userId: string,
  blueprintId?: string,
): Promise<{ id: string } | null> {
  if (blueprintId) {
    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    return bp ?? null;
  }
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return bp ?? null;
}

export type CurrentConditionView = {
  blueprintId: string;
  display: ReturnType<typeof getConditionDisplaySpec>;
  frameworkSignals: ReturnType<typeof frameworkSignalsRecord> | null;
  condition: {
    condition: string;
    durationDays: number | null;
    escalationLevel: number | null;
    recoveryRequired: boolean;
    previousCondition: string | null;
    transitionReason: string | null;
  } | null;
  enforcement: {
    id: string;
    taskLimits: unknown;
    difficultyCap: string;
    allowedActions: string[];
    blockedActions: string[];
    phasePermission: string | null;
    aiMode: string | null;
    uiMode: string | null;
    riskLevel: string | null;
  } | null;
};

export const ConditionService = {
  async getCurrent(userId: string, blueprintId?: string): Promise<CurrentConditionView | null> {
    const bp = await resolveBlueprintId(userId, blueprintId);
    if (!bp) return null;

    const [condition] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)))
      .limit(1);

    const [enforcement] = await db
      .select()
      .from(enforcementPackages)
      .where(
        and(eq(enforcementPackages.blueprint_id, bp.id), eq(enforcementPackages.is_current, true)),
      )
      .limit(1);

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, bp.id), eq(signalSnapshots.is_current, true)))
      .orderBy(desc(signalSnapshots.created_at))
      .limit(1);

    const conditionKey = condition?.condition ?? "stability";
    const display = getConditionDisplaySpec(conditionKey);

    const metrics: SignalMetrics | null = signal
      ? {
          completion_rate: signal.completion_rate,
          weighted_score: signal.weighted_score,
          momentum: signal.momentum,
          trend: signal.trend ?? "stable",
          confidence: signal.confidence ?? "medium",
          blocker_ratio: signal.blocker_ratio,
          skip_ratio: signal.skip_ratio,
          tasks_in_window: 5,
          raw_score: signal.weighted_score,
          avg_difficulty_felt: null,
        }
      : null;

    const permanent = await readPermanentFrameworkSignals(bp.id);
    const frameworkSignals = permanent
      ? frameworkSignalsRecord(
          normalizeFrameworkSignals({
            Production: permanent.signals.Production.value,
            Operations: permanent.signals.Operations.value,
            Growth: permanent.signals.Growth.value,
            Scale: permanent.signals.Scale.value,
            momentum: permanent.signals.Production.momentum,
          }),
        )
      : metrics
        ? frameworkSignalsRecord(
            metricsToFrameworkSignals(
              metrics,
              signal?.operational_mathematics_json as Parameters<typeof metricsToFrameworkSignals>[1],
            ),
          )
        : null;

    return {
      blueprintId: bp.id,
      display,
      frameworkSignals,
      condition: condition
        ? {
            condition: condition.condition,
            durationDays: condition.duration_days,
            escalationLevel: condition.escalation_level,
            recoveryRequired: condition.recovery_required,
            previousCondition: condition.previous_condition,
            transitionReason: condition.transition_reason,
          }
        : null,
      enforcement: enforcement
        ? {
            id: enforcement.id,
            taskLimits: enforcement.task_limits,
            difficultyCap: enforcement.difficulty_cap,
            allowedActions: enforcement.allowed_actions,
            blockedActions: enforcement.blocked_actions,
            phasePermission: enforcement.phase_permission,
            aiMode: enforcement.ai_mode,
            uiMode: enforcement.ui_mode,
            riskLevel: enforcement.risk_level,
          }
        : null,
    };
  },

  async getHistory(
    userId: string,
    opts: { blueprintId?: string; limit?: number },
  ): Promise<{ blueprintId: string; history: Array<Record<string, unknown>> } | null> {
    const bp = await resolveBlueprintId(userId, opts.blueprintId);
    if (!bp) return null;

    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));

    const rows = await db
      .select({
        id: conditions.id,
        condition: conditions.condition,
        previousCondition: conditions.previous_condition,
        transitionReason: conditions.transition_reason,
        recoveryRequired: conditions.recovery_required,
        durationDays: conditions.duration_days,
        enteredAt: conditions.entered_at,
        exitedAt: conditions.exited_at,
        isCurrent: conditions.is_current,
      })
      .from(conditions)
      .where(eq(conditions.blueprint_id, bp.id))
      .orderBy(desc(conditions.entered_at))
      .limit(limit);

    return {
      blueprintId: bp.id,
      history: rows.map((r) => ({
        id: r.id,
        condition: r.condition,
        previousCondition: r.previousCondition,
        transitionReason: r.transitionReason,
        recoveryRequired: r.recoveryRequired,
        durationDays: r.durationDays,
        enteredAt: r.enteredAt,
        exitedAt: r.exitedAt,
        isCurrent: r.isCurrent,
        display: getConditionDisplaySpec(r.condition),
      })),
    };
  },

  async assertBlueprintOwned(blueprintId: string, userId: string): Promise<void> {
    const bp = await resolveBlueprintId(userId, blueprintId);
    if (!bp) {
      throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    }
  },
};
