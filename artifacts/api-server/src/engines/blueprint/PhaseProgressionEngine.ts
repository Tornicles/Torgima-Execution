/**
 * TORGIMA P4 — evidence-gated blueprint phase advancement.
 */
import {
  db,
  phases,
  orders,
  feedback,
  academyTasks,
  blueprints,
  users,
  phaseCheckpoints,
  targets,
  outcomeValidations,
} from "@workspace/db";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { PhaseStatus } from "@workspace/state-machine";
import { TorgimaError } from "../../lib/errors.js";
import { checkOutcomeIntegrity } from "../outcome/OutcomeValidationEngine.js";
import { getCurrentIdentityState } from "../intelligence/IdentityContinuityEngine.js";
import type { DbIdentityStage } from "../intelligence/IdentityContinuityEngine.js";
import { BlueprintEngine } from "./BlueprintEngine.js";
import { logger } from "../../lib/logger.js";

const MIN_PHASE_DAYS = 7;
const IDENTITY_GROWTH_STAGES = new Set(["building", "establishing", "consolidated", "transforming"]);

export async function evaluatePhaseReadiness(
  blueprintId: string,
  phaseId: string,
): Promise<{ canAdvance: boolean; blockers: string[]; completionPercentage: number }> {
  const blockers: string[] = [];

  const [phase] = await db
    .select()
    .from(phases)
    .where(and(eq(phases.id, phaseId), eq(phases.blueprint_id, blueprintId)))
    .limit(1);

  if (!phase) {
    return { canAdvance: false, blockers: ["Phase not found"], completionPercentage: 0 };
  }

  const [bp] = await db
    .select({
      userId: blueprints.user_id,
      tier: users.tier,
      currentPhaseId: blueprints.current_phase_id,
    })
    .from(blueprints)
    .innerJoin(users, eq(blueprints.user_id, users.id))
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp) {
    return { canAdvance: false, blockers: ["Blueprint not found"], completionPercentage: 0 };
  }

  const phaseOrders = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.phase_id, phaseId)));

  const totalOrders = phaseOrders.length;
  let completedOrders = 0;
  if (totalOrders > 0) {
    const orderIds = phaseOrders.map((o) => o.id);
    const acceptedFeedback = await db
      .select({ order_id: feedback.order_id })
      .from(feedback)
      .where(
        and(
          inArray(feedback.order_id, orderIds),
          eq(feedback.validity, "valid"),
          inArray(feedback.completion_status, ["completed", "partial"]),
        ),
      );
    completedOrders = new Set(acceptedFeedback.map((f) => f.order_id)).size;
  }

  const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 1;
  const completionPercentage = Math.round(completionRate * 100);

  if (totalOrders > 0 && completionRate < 0.8) {
    blockers.push(
      `Complete at least 80% of phase tasks (${completedOrders}/${totalOrders} done)`,
    );
  }

  const integrity = await checkOutcomeIntegrity(bp.userId, blueprintId);
  if (!integrity.canAdvance) {
    blockers.push(...integrity.blockers);
  }

  const criticalTargets = await db
    .select({ id: targets.id })
    .from(targets)
    .where(
      and(
        eq(targets.blueprint_id, blueprintId),
        inArray(targets.status, ["active", "on_track", "at_risk"]),
      ),
    )
    .limit(5);

  for (const t of criticalTargets) {
    const [valid] = await db
      .select({ verdict: outcomeValidations.verdict })
      .from(outcomeValidations)
      .where(
        and(
          eq(outcomeValidations.blueprint_id, blueprintId),
          eq(outcomeValidations.target_id, t.id),
        ),
      )
      .orderBy(sql`${outcomeValidations.validated_at} DESC`)
      .limit(1);

    const ok =
      valid?.verdict === "VALIDATED" || valid?.verdict === "PARTIALLY_VALIDATED";
    if (!ok) {
      blockers.push("Critical target outcome must be validated before advancing");
      break;
    }
  }

  const startedAt = phase.started_at ?? phase.created_at;
  const daysActive = (Date.now() - startedAt.getTime()) / 86400000;
  if (daysActive < MIN_PHASE_DAYS) {
    blockers.push(`Phase must be active for at least ${MIN_PHASE_DAYS} days`);
  }

  if (bp.tier === "growth" || bp.tier === "ultimate") {
    const identity = await getCurrentIdentityState(bp.userId, blueprintId);
    const stage = identity?.stage as DbIdentityStage | undefined;
    if (!stage || !IDENTITY_GROWTH_STAGES.has(stage)) {
      blockers.push("Identity stage must be BUILDING or higher for your tier");
    }
  }

  const pendingAcademy = await db
    .select({ id: academyTasks.id })
    .from(academyTasks)
    .where(
      and(
        eq(academyTasks.blueprint_id, blueprintId),
        eq(academyTasks.blocks_execution, true),
        inArray(academyTasks.status, ["pending", "in_progress"]),
      ),
    )
    .limit(1);

  if (pendingAcademy.length > 0) {
    blockers.push("Complete required academy proof before advancing");
  }

  return {
    canAdvance: blockers.length === 0,
    blockers,
    completionPercentage,
  };
}

export async function advancePhase(
  blueprintId: string,
  currentPhaseId: string,
  nextPhaseId: string,
): Promise<void> {
  const readiness = await evaluatePhaseReadiness(blueprintId, currentPhaseId);
  if (!readiness.canAdvance) {
    throw new TorgimaError(
      "PHASE_NOT_READY",
      readiness.blockers.join("; ") || "Phase readiness criteria not met",
      false,
    );
  }

  const [bp] = await db
    .select({ userId: blueprints.user_id })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

  const engine = new BlueprintEngine();
  const result = await engine.advanceBlueprintPosition(blueprintId, bp.userId);

  await db.insert(phaseCheckpoints).values({
    blueprint_id: blueprintId,
    phase_id: currentPhaseId,
    user_id: bp.userId,
    evidence_summary: `Advanced to ${nextPhaseId}; completion ${readiness.completionPercentage}%`,
    readiness: "ready",
    system_verdict: "passed",
    proof_json: { next_phase_id: nextPhaseId, advanced: result.advanced },
    evaluated_at: new Date(),
  });

  logger.info({ blueprintId, result }, "[PhaseProgressionEngine] Phase advanced");
}

export const PhaseProgressionEngine = {
  evaluatePhaseReadiness,
  advancePhase,
};
