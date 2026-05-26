import {
  blueprintFrameworkSignals,
  blueprints,
  db,
  orders,
  ultimatePredictions,
  ultimateValidationCheckpoints,
} from "@workspace/db";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { ULTIMATE_SEQUENCE_NUMBER } from "./ultimateGate.js";

function determineRecoveryType(errors: string[]): string {
  if (errors.some((e) => e.toLowerCase().includes("signal"))) return "pace_adjustment";
  if (errors.some((e) => e.toLowerCase().includes("queue"))) return "milestone_review";
  return "scope_reduction";
}

export const ContinuousValidation = {
  async validate(blueprintId: string) {
    const [bp] = await db
      .select({
        current_sequence_number: blueprints.current_sequence_number,
        current_condition: blueprints.current_condition,
      })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    if (!bp) throw new Error("Blueprint not found");

    const errors: string[] = [];
    const warnings: string[] = [];
    let recoveryNeeded = false;

    const recentOrders = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.blueprint_id, blueprintId))
      .orderBy(desc(orders.created_at))
      .limit(10);

    const completionRate =
      recentOrders.filter((o) => o.status === "completed").length /
      Math.max(recentOrders.length, 1);
    const executionValid = completionRate > 0.5;
    if (!executionValid) {
      errors.push("Execution diverged from expected path");
      recoveryNeeded = true;
    }

    const recentPreds = await db
      .select({ prediction_correct: ultimatePredictions.prediction_correct })
      .from(ultimatePredictions)
      .where(
        and(
          eq(ultimatePredictions.blueprint_id, blueprintId),
          isNotNull(ultimatePredictions.prediction_correct),
        ),
      )
      .orderBy(desc(ultimatePredictions.created_at))
      .limit(5);

    const predictionAccuracy =
      recentPreds.filter((p) => p.prediction_correct).length / Math.max(recentPreds.length, 1);
    if (recentPreds.length >= 3 && predictionAccuracy < 0.5) {
      warnings.push("Prediction accuracy declining — model may need retraining");
    }

    const signals = await db
      .select({ signal_key: blueprintFrameworkSignals.signal_key, value: blueprintFrameworkSignals.value })
      .from(blueprintFrameworkSignals)
      .where(eq(blueprintFrameworkSignals.blueprint_id, blueprintId));

    const prod = signals.find((s) => s.signal_key === "Production")?.value ?? 0.5;
    const ops = signals.find((s) => s.signal_key === "Operations")?.value ?? 0.5;
    if (prod < 0.4 || ops < 0.3) {
      errors.push("Critical signal degradation detected");
      recoveryNeeded = true;
    }

    const pending = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          inArray(orders.status, ["pending", "active", "needs_feedback"]),
        ),
      )
      .limit(1);

    if (pending.length === 0) {
      warnings.push("No pending tasks — queue regeneration recommended");
    }

    const seq = bp.current_sequence_number ?? ULTIMATE_SEQUENCE_NUMBER;
    const [checkpoint] = await db
      .insert(ultimateValidationCheckpoints)
      .values({
        blueprint_id: blueprintId,
        sequence_number: seq,
        execution_valid: executionValid,
        prediction_valid: predictionAccuracy > 0.5 || recentPreds.length === 0,
        scene_valid: true,
        validation_errors: errors,
        warnings,
        recovery_needed: recoveryNeeded,
        recovery_type: recoveryNeeded ? determineRecoveryType(errors) : null,
      })
      .returning();

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recovery_needed: recoveryNeeded,
      checkpoint: checkpoint!,
    };
  },

  async getRecentCheckpoints(blueprintId: string, limit = 10) {
    return db
      .select()
      .from(ultimateValidationCheckpoints)
      .where(eq(ultimateValidationCheckpoints.blueprint_id, blueprintId))
      .orderBy(desc(ultimateValidationCheckpoints.created_at))
      .limit(limit);
  },
};
