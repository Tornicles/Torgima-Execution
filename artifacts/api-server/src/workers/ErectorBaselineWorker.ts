import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db, blueprints, erectorIntakeSessions, erectorRealityPackages, signalSnapshots, conditions, enforcementPackages, stateMemory } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { emitEvent, EVENT_TYPES } from "../services/EventService.js";
import { WorkerQueues, EventTypes } from "../types/eventContracts.js";
import { CONDITIONS } from "../constants/conditions.js";
import { resolveArchetype } from "../engines/erector/ArchetypeResolutionEngine.js";
import type { ErectorRealityPackage } from "../services/erector/ErectorRealityPackage.js";

export const ERECTOR_BASELINE_QUEUE = WorkerQueues.ERECTOR_BASELINE;

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

async function bootstrapInitialCondition(params: {
  blueprintId: string;
  userId: string;
  assignedCondition: string;
}): Promise<{ enforcementPackageId: string | null }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 86400000);

  const [signal] = await db
    .insert(signalSnapshots)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      window_start: windowStart,
      window_end: now,
      completion_rate: 0,
      weighted_score: 0,
      momentum: 0,
      trend: "stable",
      confidence: "low",
      blocker_ratio: 0,
      skip_ratio: 0,
      assigned_condition: params.assignedCondition as never,
      is_current: true,
    })
    .returning();

  const signalId = signal?.id ?? null;

  const [cond] = await db
    .insert(conditions)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      condition: params.assignedCondition as never,
      duration_days: 2,
      escalation_level: 0,
      recovery_required: false,
      is_current: true,
      signal_snapshot_id: signalId,
    })
    .returning();

  const conditionId = cond?.id ?? null;

  const [enf] = await db
    .insert(enforcementPackages)
    .values({
      blueprint_id: params.blueprintId,
      condition_id: conditionId,
      signal_snapshot_id: signalId,
      condition: params.assignedCondition as never,
      task_limits: { min: 1, max: 2 },
      difficulty_cap: "easy",
      allowed_actions: ["task_execution", "feedback_submission"],
      blocked_actions: [],
      phase_permission: "restricted",
      ai_mode: "stabilization",
      ui_mode: "focused",
      is_current: true,
    })
    .returning();

  await db
    .insert(stateMemory)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      condition: params.assignedCondition as never,
      entered_at: now,
      is_current: true,
      duration_days: 2,
      escalation_level: 0,
    })
    .catch(() => null);

  return { enforcementPackageId: enf?.id ?? null };
}

workerRegistry.register({
  name: "ErectorBaselineWorker",
  queue: ERECTOR_BASELINE_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ErectorBaselineWorker", async (data) => {
        const { blueprintId, userId, payload, eventId } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const intakeSessionId =
          (payload as Record<string, unknown> | undefined)?.["intake_session_id"] as string | undefined;

        const [session] = intakeSessionId
          ? await db
              .select()
              .from(erectorIntakeSessions)
              .where(and(eq(erectorIntakeSessions.id, intakeSessionId), eq(erectorIntakeSessions.user_id, userId)))
              .limit(1)
          : [];

        const normalized = (session?.normalized_payload ?? {}) as Record<string, unknown>;
        const location = safeString(normalized.location) ?? safeString(normalized.country) ?? "Unknown";

        const resolution = await resolveArchetype(location, "Unknown");
        const archetypeName = resolution?.primaryArchetype?.name ?? "Unknown";
        const archetypeConfidence = resolution?.combinedExecutionIntensityMultiplier ? 0.7 : 0.5;

        const pkg: ErectorRealityPackage = {
          identity: {
            blueprint_id: blueprintId,
            user_id: userId,
            tier: session?.tier ?? null,
            generated_at: new Date().toISOString(),
            model_version: "v0.1",
            validation_run_id: session?.validation_id ?? null,
            intake_session_id: session?.id ?? null,
            trigger_event_type: null,
            trigger_event_id: eventId ?? null,
          },
          goal_baseline: {
            refined_goal: safeString(normalized.what_building) ?? safeString(normalized.whatBuilding),
            purpose_summary: safeString(normalized.why_it_matters) ?? safeString(normalized.whyItMatters),
            success_definition: safeString(normalized.success_30_days) ?? safeString(normalized.success30Days),
            failure_definition: null,
            scope_boundaries: [],
          },
          market_baseline: {
            market_type: safeString(normalized.market_scope) ?? safeString(normalized.scope),
            demand_level: null,
            competition_level: null,
            saturation_level: null,
            target_user: safeString(normalized.target_who) ?? safeString(normalized.who),
            customer_pain: safeString(normalized.problem_solved) ?? safeString(normalized.problem),
            differentiation_angle: safeString(normalized.differentiation),
            demand_proof_required: true,
          },
          economy_baseline: {
            country: location,
            location,
            economy_type: archetypeName,
            economic_constraints: [],
            payment_constraints: [],
            infrastructure_constraints: [],
            regulatory_flags: [],
          },
          execution_baseline: {
            execution_difficulty: null,
            required_resources: [],
            missing_resources: [],
            capability_gaps: [],
            workload_realism: null,
            timeline_realism: null,
            critical_dependencies: [],
          },
          archetype_baseline: {
            erector_archetype: archetypeName,
            archetype_confidence: Number.isFinite(archetypeConfidence) ? archetypeConfidence : 0.6,
            archetype_rule_pack_id: null,
            archetype_risks: [],
            archetype_success_patterns: [],
            archetype_false_progress_patterns: [],
          },
          risk_baseline: {
            execution_risks: [],
            market_risks: [],
            distribution_risks: [],
            financial_risks: [],
            capability_risks: [],
            dependency_risks: [],
            systemic_risks: [],
          },
          strategy_baseline: {
            current_path: null,
            adjusted_path: null,
            alternative_path: null,
            recommended_path: null,
            strategic_constraints: [],
            first_90_day_focus: [],
          },
          blueprint_generation_inputs: {
            plan_modifiers: [],
            target_modifiers: [],
            phase_modifiers: [],
            project_modifiers: [],
            action_modifiers: [],
            task_generation_constraints: [],
            knowledge_requirements: [],
            proof_requirements: [],
            signal_watchpoints: [],
            condition_sensitivity: null,
          },
          report_baseline: {
            executive_summary: null,
            validation_summary: null,
            simulation_summary: null,
            recommendation_summary: null,
          },
        };

        const [inserted] = await db
          .insert(erectorRealityPackages)
          .values({
            blueprint_id: blueprintId,
            user_id: userId,
            intake_session_id: session?.id ?? null,
            validation_run_id: session?.validation_id ?? null,
            tier: session?.tier ?? null,
            model_version: "v0.1",
            package_json: pkg,
          })
          .returning();

        const baselineId = inserted?.id;
        if (!baselineId) return { success: false, retryable: true, reason: "baseline_insert_failed" };

        await db
          .update(blueprints)
          .set({
            erector_baseline_state: "baseline_ready",
            erector_baseline_id: baselineId,
            baseline_generated_at: new Date(),
            erector_archetype: archetypeName,
            execution_state: "locked",
            dashboard_mode: "baseline_generating",
            current_condition: CONDITIONS.NOTHINGNESS,
          })
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)));

        await bootstrapInitialCondition({
          blueprintId,
          userId,
          assignedCondition: CONDITIONS.NOTHINGNESS,
        }).catch(() => null);

        await emitEvent({
          eventType: EVENT_TYPES.ERECTOR_BASELINE_COMPLETED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { erector_baseline_id: baselineId, erector_archetype: archetypeName },
          idempotencyKey: `erector_baseline_completed:${blueprintId}`,
        }).catch(() => null);

        await emitEvent({
          eventType: EVENT_TYPES.BLUEPRINT_EXECUTION_GENERATION_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { erector_baseline_id: baselineId, trigger: "paid_intake_submit" },
          idempotencyKey: `blueprint_execution_generation_requested:${blueprintId}`,
        }).catch(() => null);

        return { success: true };
      });
    }
  },
});

