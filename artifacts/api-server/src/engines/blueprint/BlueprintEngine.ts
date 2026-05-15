import { db } from "@workspace/db";
import {
  blueprints,
  plans,
  seasons,
  targets,
  phases,
  projects,
  actions,
  conditions,
  enforcementPackages,
  stateMemory,
  domainHistory,
  blueprintVersions,
  blueprintMutations,
  signalSnapshots,
  validations,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { writeEventInTx, writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { BlueprintRepository } from "../../repositories/BlueprintRepository.js";
import { DomainResolutionEngine } from "../domain/DomainResolutionEngine.js";
import type { BlueprintDraftInput, BlueprintPosition, BlueprintStateView } from "../../types/blueprint.js";
import { CONDITIONS } from "../../constants/conditions.js";
import { pauseBlueprint } from "../lifecycle/PauseEngine.js";
import { resumeBlueprint } from "../lifecycle/ResumeEngine.js";
import { RealityIntelligenceEngine } from "../intelligence/RealityIntelligenceEngine.js";
import { buildTierAwareBlueprintChain } from "./BlueprintChainGenerator.js";
import {
  assertSelectionComplete,
  getTierRules,
  intelligenceDepthForTier,
  parseMode,
  parseTier,
  type BlueprintMode,
  type BlueprintTier,
} from "./BlueprintRuleEngine.js";
import { assertFeatureAllowed } from "./infrastructure/FeatureGatingEngine.js";
import {
  compileChainInTransaction,
  validateHierarchyAfterCompile,
} from "./infrastructure/compileInTransaction.js";
import { invalidateHydrationCache } from "./infrastructure/StateHydrationService.js";
import { blueprintMembers } from "@workspace/db";
import { getClientFeatureManifest } from "./infrastructure/BlueprintTypeRegistry.js";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const domainEngine = new DomainResolutionEngine();

/**
 * BlueprintEngine — Full Prompt 4 implementation.
 *
 * Manages the complete blueprint lifecycle:
 *   createDraft → buildChain (on activate) → activateBlueprint (cold start)
 *   → pause / resume → getPosition / getStateView
 */
export class BlueprintEngine {
  // ── CREATE DRAFT ──────────────────────────────────────────────────────────

  async createDraft(
    userId: string,
    input: BlueprintDraftInput,
  ): Promise<{ blueprintId: string }> {
    logger.info({ userId, goal: input.goal }, "BlueprintEngine.createDraft");

    const resolvedDomain = domainEngine.resolve(input.goal, input.domainHint ?? null);

    const [bp] = await db
      .insert(blueprints)
      .values({
        user_id: userId,
        goal: input.goal,
        purpose: input.purpose ?? null,
        current_domain: resolvedDomain,
        domain_hint: input.domainHint ?? null,
        commitment_level: input.commitmentLevel ?? null,
        status: "draft",
        active: false,
        version: 1,
        state_version: 0,
      })
      .returning({ id: blueprints.id });

    if (!bp) throw new TorgimaError("INTERNAL_ERROR", "Failed to create blueprint");

    logger.info({ blueprintId: bp.id, domain: resolvedDomain }, "BlueprintEngine.createDraft — complete");
    return { blueprintId: bp.id };
  }

  // ── CONFIGURE SELECTION ───────────────────────────────────────────────────

  async configureSelection(
    blueprintId: string,
    userId: string,
    input: { tier: BlueprintTier; mode: BlueprintMode },
  ): Promise<{ blueprintId: string; tier: BlueprintTier; mode: BlueprintMode; intelligenceDepth: string }> {
    const bp = await BlueprintRepository.findById(blueprintId, userId);
    if (bp.status === "active") {
      throw new TorgimaError("BLUEPRINT_ALREADY_ACTIVE", "Cannot change selection on an active blueprint");
    }

    const tier = parseTier(input.tier);
    const mode = parseMode(input.mode);
    const tierRules = getTierRules(tier);
    const depth = intelligenceDepthForTier(tier);
    const now = new Date();

    const nextStatus =
      bp.validation_id ? "path_selection"
      : bp.status === "draft" || bp.status === "validating" ? "awaiting_selection"
      : "awaiting_selection";

    await db
      .update(blueprints)
      .set({
        tier,
        mode,
        intelligence_depth: depth,
        selection_confirmed_at: now,
        blueprint_config: {
          featureManifest: getClientFeatureManifest(tier, mode),
          tierRules: {
            allowedSystems: tierRules.allowedSystems,
            lockedSystems: tierRules.lockedSystems,
            maxDailyOrders: tierRules.maxDailyOrders,
            validationDepth: tierRules.validationDepth,
          },
          mode,
          intelligenceDepth: depth,
        },
        status: nextStatus,
      })
      .where(eq(blueprints.id, blueprintId));

    logger.info({ blueprintId, tier, mode, depth }, "BlueprintEngine.configureSelection");
    return { blueprintId, tier, mode, intelligenceDepth: depth };
  }

  // ── ACTIVATE (COLD START) ─────────────────────────────────────────────────

  async activateBlueprint(
    blueprintId: string,
    userId: string,
  ): Promise<{ launched: true; blueprintId: string }> {
    logger.info({ blueprintId, userId }, "BlueprintEngine.activateBlueprint");

    const existing = await BlueprintRepository.findById(blueprintId, userId);
    if (existing.status === "active") {
      throw new TorgimaError("BLUEPRINT_ALREADY_ACTIVE", "Blueprint is already active");
    }

    assertSelectionComplete({
      tier: existing.tier,
      mode: existing.mode,
      selectionConfirmedAt: existing.selection_confirmed_at,
    });

    const tier = parseTier(existing.tier);
    const mode = parseMode(existing.mode);
    const tierRules = getTierRules(tier);

    assertFeatureAllowed({ tier, mode, feature: "orders", surface: "generation" });

    const resolvedDomain = domainEngine.resolve(existing.goal, existing.domain_hint);

    const intelligence = await RealityIntelligenceEngine.analyze({
      rawGoal: existing.goal,
      goal: existing.goal,
      domain: String(existing.current_domain ?? resolvedDomain),
      purpose: existing.purpose ?? "",
      blueprintId,
      userId,
    });

    await db.transaction(async (tx) => {
      // 1. Update blueprint to active. Initial condition is `nothingness` —
      //    the system is bootstrapping, no signal data exists yet.
      await tx
        .update(blueprints)
        .set({
          status: "active",
          active: true,
          current_domain: resolvedDomain,
          current_condition: CONDITIONS.NOTHINGNESS,
          state_version: 1,
        })
        .where(eq(blueprints.id, blueprintId));

      // 2. Read validation path selection (if any) to customise chain
      const validationRows = await tx
        .select({
          selected_path:   validations.selected_path,
          path_current:    validations.path_current,
          path_adjusted:   validations.path_adjusted,
          path_alternative: validations.path_alternative,
        })
        .from(validations)
        .where(eq(validations.blueprint_id, blueprintId))
        .orderBy(desc(validations.created_at))
        .limit(1);

      let pathSkeleton:
        | { plans: Array<{ name: string; description: string }>; targets: Array<{ name: string; type: string }> }
        | undefined;

      const valRow = validationRows[0];
      if (valRow?.selected_path) {
        const pathData = {
          current:     valRow.path_current,
          adjusted:    valRow.path_adjusted,
          alternative: valRow.path_alternative,
        }[valRow.selected_path] as { planSkeleton?: typeof pathSkeleton } | null;

        if (pathData?.planSkeleton) {
          pathSkeleton = pathData.planSkeleton;
          logger.info(
            { blueprintId, selectedPath: valRow.selected_path },
            "BlueprintEngine.activateBlueprint — using validation path skeleton",
          );
        }
      }

      // 3. Compile tier/mode-aware execution chain (deterministic, validated)
      const chain = await compileChainInTransaction(tx, {
        blueprintId,
        userId,
        goal: existing.goal,
        purpose: existing.purpose,
        tier,
        mode,
        pathSkeleton,
      });

      if (mode === "team") {
        await tx
          .insert(blueprintMembers)
          .values({
            blueprint_id: blueprintId,
            user_id: userId,
            role: "owner",
            invited_by: userId,
            active: true,
          })
          .onConflictDoNothing();
      }

      // 4. Update blueprint with current plan and phase
      await tx
        .update(blueprints)
        .set({
          current_plan_id: chain.planId,
          current_phase_id: chain.phaseId,
          intel_metadata: {
            realityIntelligence: intelligence,
            marketMomentum: intelligence.marketMomentum,
            strongestAngle: intelligence.positioning.strongestAngle,
            blueprintSeedingInstructions: intelligence.blueprintSeedInstructions,
            executionImplication: intelligence.executionImplication,
            intelligenceGeneratedAt: new Date().toISOString(),
          },
        })
        .where(eq(blueprints.id, blueprintId));

      // 4. Initial signal snapshot — placeholder so checkSignalChainContinuity
      //    has a row from the start; SignalWorker overwrites on first feedback.
      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 24 * 3600_000);
      await tx.insert(signalSnapshots).values({
        blueprint_id:       blueprintId,
        user_id:            userId,
        window_start:       windowStart,
        window_end:         now,
        completion_rate:    0,
        weighted_score:     0,
        momentum:           0,
        trend:              "stable",
        confidence:         "insufficient_data",
        assigned_condition: CONDITIONS.NOTHINGNESS,
        is_current:         true,
      });

      // 5. Initial condition record (nothingness)
      await tx.insert(conditions).values({
        blueprint_id:       blueprintId,
        user_id:            userId,
        condition:          CONDITIONS.NOTHINGNESS,
        duration_days:      0,
        escalation_level:   0,
        recovery_required:  false,
        is_current:         true,
        entered_at:         new Date(),
      });

      // 6. Initial enforcement package — nothingness defaults: minimum
      //    viable execution. Real package generator runs in Prompt 7+.
      await tx.insert(enforcementPackages).values({
        blueprint_id:        blueprintId,
        condition:           CONDITIONS.NOTHINGNESS,
        task_limits:         { daily_max: 1, active_max: 1 },
        difficulty_cap:
          tier === "starter" ? "very_easy"
          : tier === "growth" ? "moderate"
          : "hard",
        allowed_actions:     tier === "starter" ? ["create", "analyze"] : ["create", "analyze", "measure", "improve"],
        blocked_actions:     tierRules.lockedSystems,
        phase_permission:    tier === "starter" ? "restricted" : "normal",
        ai_mode:             tier === "ultimate" ? "analytical" : "command",
        ui_mode:             tierRules.uiMode as typeof enforcementPackages.$inferInsert["ui_mode"],
        feature_permissions: {
          weekly_review: tier !== "starter",
          phase_advance: tier !== "starter",
          pivot: tier === "ultimate",
          team_mode: mode === "team",
          predictive_signals: tier === "ultimate",
        },
        risk_level:          "low",
        is_current:          true,
      });

      // 7. State memory record (nothingness)
      await tx.insert(stateMemory).values({
        blueprint_id:     blueprintId,
        user_id:          userId,
        condition:        CONDITIONS.NOTHINGNESS,
        duration_days:    0,
        escalation_level: 0,
        is_current:       true,
        entered_at:       new Date(),
      });

      // 8. Domain history record
      await tx.insert(domainHistory).values({
        blueprint_id:       blueprintId,
        user_id:            userId,
        domain:             resolvedDomain,
        previous_domain:    null,
        transition_trigger: "blueprint_launched",
        transition_notes:   `Blueprint launched with domain: ${resolvedDomain}`,
        is_current:         true,
        entered_at:         new Date(),
      });

      // 9. Blueprint version record
      await tx.insert(blueprintVersions).values({
        blueprint_id: blueprintId,
        version_number: 1,
        change_type: "chain_created",
        affected_layer: "blueprint",
        before_state: {},
        after_state: {
          plans: chain.planCount,
          phases: chain.phaseCount,
          targets: chain.targetCount,
          actions: chain.actionCount,
          domain: resolvedDomain,
        },
        triggered_by: userId,
      });

      // 10. Blueprint mutation record (approved immediately on launch)
      await tx.insert(blueprintMutations).values({
        blueprint_id:   blueprintId,
        mutation_type:  "LAUNCH",
        layer:          "blueprint",
        entity_id:      null,
        change_summary: `Blueprint activated with domain ${resolvedDomain}. Chain built: ${chain.phaseCount} phases, ${chain.actionCount} actions.`,
        cascade_json:   [],
        approved:       true,
        approved_at:    new Date(),
      });

      // 11. Write BLUEPRINT_LAUNCHED event
      await writeEventInTx(
        {
          eventType:      EVENT_TYPES.BLUEPRINT_LAUNCHED,
          entityType:     "blueprint",
          entityId:       blueprintId,
          userId,
          blueprintId,
          payload: {
            domain: resolvedDomain,
            tier,
            mode,
            intelligenceDepth: intelligenceDepthForTier(tier),
            chain: {
              plans:   chain.planCount,
              seasons: chain.seasonCount,
              phases:  chain.phaseCount,
              targets: chain.targetCount,
              actions: chain.actionCount,
            },
          },
          idempotencyKey: `blueprint_launched_${blueprintId}`,
        },
        tx,
      );

      // 12. Cold start: fire TASK_GENERATION_REQUESTED
      await writeEventInTx(
        {
          eventType:  EVENT_TYPES.TASK_GENERATION_REQUESTED,
          entityType: "blueprint",
          entityId:   blueprintId,
          userId,
          blueprintId,
          payload: {
            trigger:   "cold_start",
            phaseId:   chain.phaseId,
            planId:    chain.planId,
            condition: CONDITIONS.NOTHINGNESS,
            domain:    resolvedDomain,
          },
          idempotencyKey: `task_gen_cold_start_${blueprintId}`,
        },
        tx,
      );
    });

    await validateHierarchyAfterCompile(blueprintId, tier, mode);
    invalidateHydrationCache(blueprintId);

    logger.info({ blueprintId }, "BlueprintEngine.activateBlueprint — complete");
    return { launched: true, blueprintId };
  }

  // ── PAUSE ─────────────────────────────────────────────────────────────────

  async pause(blueprintId: string, userId: string, reason: string): Promise<typeof blueprints.$inferSelect> {
    logger.info({ blueprintId, userId }, "BlueprintEngine.pause");

    await pauseBlueprint({ blueprintId, userId, reason });
    return BlueprintRepository.findById(blueprintId, userId);
  }

  // ── RESUME ────────────────────────────────────────────────────────────────

  async resume(blueprintId: string, userId: string): Promise<typeof blueprints.$inferSelect> {
    logger.info({ blueprintId, userId }, "BlueprintEngine.resume");

    await resumeBlueprint({ blueprintId, userId });
    return BlueprintRepository.findById(blueprintId, userId);
  }

  // ── ADVANCE POSITION ──────────────────────────────────────────────────────

  // Marks the active phase complete, unlocks and activates the next phase,
  // and writes a BlueprintMutation row for the transition. Builds projects
  // for the newly-active phase if it has none yet (placeholder — real
  // per-phase generation lives in TaskGenerationEngine, Prompt 8+).
  //
  // Spec: Prompt 4 §advanceBlueprintPosition.
  async advanceBlueprintPosition(
    blueprintId: string,
    userId: string,
  ): Promise<{
    advanced: boolean;
    completedPhaseId: string | null;
    nextPhaseId: string | null;
    blueprintComplete: boolean;
  }> {
    logger.info({ blueprintId, userId }, "BlueprintEngine.advanceBlueprintPosition");

    const bp = await BlueprintRepository.findById(blueprintId, userId);
    if (bp.status !== "active") {
      throw new TorgimaError("BLUEPRINT_NOT_ACTIVE", "Blueprint must be active to advance");
    }

    return db.transaction(async (tx) => {
      const allPhases = await tx
        .select()
        .from(phases)
        .where(eq(phases.blueprint_id, blueprintId))
        .orderBy(phases.order_index);

      const activePhase = allPhases.find((p) => p.status === "active");
      if (!activePhase) {
        return { advanced: false, completedPhaseId: null, nextPhaseId: null, blueprintComplete: false };
      }

      const now = new Date();
      await tx
        .update(phases)
        .set({ status: "complete", gate_passed: true, completed_at: now })
        .where(eq(phases.id, activePhase.id));

      const nextPhase = allPhases.find(
        (p) => p.order_index > activePhase.order_index && p.status !== "complete",
      );

      if (!nextPhase) {
        await tx
          .update(blueprints)
          .set({ status: "complete", active: false, completed_at: now })
          .where(eq(blueprints.id, blueprintId));

        await writeEventInTx(
          {
            eventType:      EVENT_TYPES.BLUEPRINT_COMPLETED,
            entityType:     "blueprint",
            entityId:       blueprintId,
            userId,
            blueprintId,
            payload:        { final_phase_id: activePhase.id },
            idempotencyKey: `blueprint_completed_${blueprintId}`,
          },
          tx,
        );

        await tx.insert(blueprintMutations).values({
          blueprint_id:   blueprintId,
          mutation_type:  "PHASE_ADVANCE",
          layer:          "phase",
          entity_id:      activePhase.id,
          change_summary: `Final phase ${activePhase.name} completed; blueprint marked complete.`,
          cascade_json:   [],
          approved:       true,
          approved_at:    now,
        });

        return {
          advanced:          true,
          completedPhaseId:  activePhase.id,
          nextPhaseId:       null,
          blueprintComplete: true,
        };
      }

      await tx
        .update(phases)
        .set({ status: "active", locked: false, started_at: now })
        .where(eq(phases.id, nextPhase.id));

      // Build at least one placeholder project for the new phase if it has none.
      // Real per-phase project generation runs in TaskGenerationEngine (Prompt 8+).
      const existingProjects = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.phase_id, nextPhase.id))
        .limit(1);

      if (existingProjects.length === 0 && nextPhase.target_id) {
        await tx.insert(projects).values({
          blueprint_id: blueprintId,
          phase_id:     nextPhase.id,
          target_id:    nextPhase.target_id,
          owner_id:     userId,
          name:         `${nextPhase.name} — initial project`,
          description:  `Auto-generated placeholder for ${nextPhase.name} phase`,
          type:         "execution",
          order_index:  1,
          status:       "active",
          started_at:   now,
        });
      }

      await tx
        .update(blueprints)
        .set({ current_phase_id: nextPhase.id })
        .where(eq(blueprints.id, blueprintId));

      await tx.insert(blueprintMutations).values({
        blueprint_id:   blueprintId,
        mutation_type:  "PHASE_ADVANCE",
        layer:          "phase",
        entity_id:      activePhase.id,
        change_summary: `Phase ${activePhase.name} → ${nextPhase.name} (locked: false)`,
        cascade_json:   [{ from_phase: activePhase.id, to_phase: nextPhase.id }],
        approved:       true,
        approved_at:    now,
      });

      await writeEventInTx(
        {
          eventType:      EVENT_TYPES.TASK_GENERATION_REQUESTED,
          entityType:     "blueprint",
          entityId:       blueprintId,
          userId,
          blueprintId,
          payload:        {
            generation_trigger: "phase_completed",
            generation_mode:    "post_feedback",
            phase_id:           nextPhase.id,
          },
          idempotencyKey: `task_gen_phase_${nextPhase.id}`,
        },
        tx,
      );

      return {
        advanced:          true,
        completedPhaseId:  activePhase.id,
        nextPhaseId:       nextPhase.id,
        blueprintComplete: false,
      };
    });
  }

  // ── PUBLIC CHAIN BUILDER ─────────────────────────────────────────────────
  // Spec exposes `buildBlueprintChain`. Internal `buildChain` is private.
  // This wrapper opens a transaction for callers that don't already have one.
  async buildBlueprintChain(
    blueprintId: string,
    userId: string,
    goal: string,
    pathSkeleton?: {
      plans:   Array<{ name: string; description: string }>;
      targets: Array<{ name: string; type: string }>;
    },
  ): Promise<{
    planId: string;
    phaseId: string;
    planCount: number;
    phaseCount: number;
    targetCount: number;
    actionCount: number;
    seasonCount: number;
  }> {
    const bp = await BlueprintRepository.findById(blueprintId, userId);
    const tier = parseTier(bp.tier);
    const mode = parseMode(bp.mode);
    return db.transaction(async (tx) => {
      return buildTierAwareBlueprintChain(tx, {
        blueprintId,
        userId,
        goal,
        purpose: bp.purpose,
        tier,
        mode,
        pathSkeleton,
      });
    });
  }

  // ── GET POSITION ──────────────────────────────────────────────────────────

  async getPosition(blueprintId: string): Promise<BlueprintPosition> {
    const allPhases = await BlueprintRepository.getPhases(blueprintId);
    const allPlans = await BlueprintRepository.getPlans(blueprintId);

    const activePhase = allPhases.find((p) => p.status === "active") ?? allPhases[0] ?? null;
    const activePlan = allPlans[0] ?? null;

    const completedPhases = allPhases.filter((p) => p.status === "complete").length;
    const totalPhases = allPhases.length || 3;
    const progressPercent =
      totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    return {
      blueprintId,
      currentPlanId: activePlan?.id ?? null,
      currentPhaseId: activePhase?.id ?? null,
      currentPhaseIndex: activePhase ? allPhases.findIndex((p) => p.id === activePhase.id) + 1 : 1,
      totalPhases,
      phaseProgressPercent: progressPercent,
      currentPlanName: activePlan?.name ?? null,
      currentPhaseName: activePhase?.name ?? null,
      phaseStatus: activePhase?.status ?? null,
    };
  }

  // ── GET STATE VIEW ────────────────────────────────────────────────────────

  async getStateView(blueprintId: string, userId: string): Promise<BlueprintStateView> {
    const bp = await BlueprintRepository.findById(blueprintId, userId);
    const [condRow, enfRow, position] = await Promise.all([
      BlueprintRepository.getCurrentCondition(blueprintId),
      BlueprintRepository.getCurrentEnforcement(blueprintId),
      this.getPosition(blueprintId),
    ]);

    const dbCondition = condRow?.condition ?? bp.current_condition ?? null;

    return {
      blueprintId: bp.id,
      goal:        bp.goal,
      domain:      bp.current_domain ?? "genesis",
      status:      bp.status as import("../../types/blueprint.js").BlueprintStatus,
      condition:   dbCondition,
      position,
      enforcement: enfRow
        ? {
            taskLimits: (enfRow.task_limits as Record<string, unknown>) ?? {},
            difficultyCap: enfRow.difficulty_cap,
            allowedActions: enfRow.allowed_actions ?? [],
            blockedActions: enfRow.blocked_actions ?? [],
            aiMode: enfRow.ai_mode ?? null,
            uiMode: enfRow.ui_mode ?? null,
            phasePermission: enfRow.phase_permission ?? null,
            targetAdjustment: enfRow.target_adjustment ?? null,
            riskLevel: enfRow.risk_level ?? null,
          }
        : null,
      pausedAt: bp.paused_at?.toISOString() ?? null,
      pauseReason: bp.pause_reason ?? null,
      activatedAt: null,
      createdAt: bp.created_at.toISOString(),
    };
  }

  // ── LEGACY SHAPE MAPPER ───────────────────────────────────────────────────

  mapToLegacy(bp: typeof blueprints.$inferSelect, phase = 1, totalPhases = 3): import("../../types/blueprint.js").Blueprint {
    return {
      id: bp.id,
      userId: bp.user_id,
      title: bp.goal.slice(0, 80),
      rawGoal: bp.goal,
      domain: bp.current_domain ?? "genesis",
      status: bp.status as import("../../types/blueprint.js").BlueprintStatus,
      phase,
      totalPhases,
      currentCondition: bp.current_condition ?? null,
      pausedReason: bp.pause_reason ?? null,
      activatedAt: null,
      completedAt: bp.completed_at?.toISOString() ?? null,
      createdAt: bp.created_at.toISOString(),
    };
  }
}
