import { Router } from "express";
import {
  db,
  blueprints,
  conditions as conditionsTable,
  enforcementPackages,
  orders,
  plans,
  phases,
  signalSnapshots,
  users,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getUserFacingHealthState } from "../services/SystemHealthService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/state/dashboard
// Versioned projection used by the frontend store.
// Spec: Prompt 6 §STEP 6, DOC_15 §18, DOC_17 §19.
router.get("/state/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        display_name: users.display_name,
        tier: users.tier,
        mode: users.mode,
        onboarding_complete: users.onboarding_complete,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const [blueprint] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    const [signal, condition, enforcement, currentOrder, planRow, phaseRow, health] =
      await Promise.all([
        blueprint
          ? db
              .select()
              .from(signalSnapshots)
              .where(
                and(
                  eq(signalSnapshots.blueprint_id, blueprint.id),
                  eq(signalSnapshots.is_current, true),
                ),
              )
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        blueprint
          ? db
              .select()
              .from(conditionsTable)
              .where(
                and(
                  eq(conditionsTable.blueprint_id, blueprint.id),
                  eq(conditionsTable.is_current, true),
                ),
              )
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        blueprint
          ? db
              .select()
              .from(enforcementPackages)
              .where(
                and(
                  eq(enforcementPackages.blueprint_id, blueprint.id),
                  eq(enforcementPackages.is_current, true),
                ),
              )
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        blueprint
          ? db
              .select()
              .from(orders)
              .where(
                and(
                  eq(orders.blueprint_id, blueprint.id),
                  inArray(orders.status, ["pending", "active"]),
                ),
              )
              .orderBy(desc(orders.priority))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        blueprint?.current_plan_id
          ? db
              .select({ name: plans.name })
              .from(plans)
              .where(eq(plans.id, blueprint.current_plan_id))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        blueprint?.current_phase_id
          ? db
              .select({ name: phases.name })
              .from(phases)
              .where(eq(phases.id, blueprint.current_phase_id))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),

        getUserFacingHealthState(auth.userId),
      ]);

    success(res, {
      stateVersion: blueprint?.state_version ?? 0,
      projectionVersion: Date.now(),
      user: user
        ? {
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            tier: user.tier,
            mode: user.mode,
            onboardingComplete: user.onboarding_complete,
          }
        : null,
      activeBlueprint: blueprint
        ? {
            id: blueprint.id,
            goal: blueprint.goal,
            status: blueprint.status,
            currentDomain: blueprint.current_domain,
            currentCondition: blueprint.current_condition,
            currentPlanName: planRow?.name ?? null,
            currentPhaseName: phaseRow?.name ?? null,
          }
        : null,
      currentAction: currentOrder
        ? {
            orderId: currentOrder.id,
            title: currentOrder.title,
            instruction: currentOrder.instruction,
            expectedOutput: currentOrder.expected_output,
            definitionOfDone: currentOrder.definition_of_done,
            whyItMatters: currentOrder.why_it_matters,
            difficulty: currentOrder.difficulty,
            timeEstimate: currentOrder.time_estimate_minutes,
            proofRequired: currentOrder.proof_required,
            proofType: currentOrder.proof_type,
            status: currentOrder.status,
          }
        : null,
      condition: condition
        ? {
            condition: condition.condition,
            durationDays: condition.duration_days,
            escalationLevel: condition.escalation_level,
            recoveryRequired: condition.recovery_required,
          }
        : null,
      signal: signal
        ? {
            completionRate: signal.completion_rate,
            weightedScore: signal.weighted_score,
            momentum: signal.momentum,
            trend: signal.trend,
            confidence: signal.confidence,
          }
        : null,
      enforcement: enforcement
        ? {
            taskLimits: enforcement.task_limits,
            difficultyCap: enforcement.difficulty_cap,
            allowedActions: enforcement.allowed_actions,
            blockedActions: enforcement.blocked_actions,
            aiMode: enforcement.ai_mode,
            uiMode: enforcement.ui_mode,
            riskLevel: enforcement.risk_level,
          }
        : null,
      health: {
        systemOperational: health.systemOperational,
        executionAvailable: health.executionAvailable,
        message: health.message,
      },
      pendingSync: false,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
