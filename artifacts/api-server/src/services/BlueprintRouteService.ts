import {
  db,
  blueprints,
  validations,
  phases,
  events,
  domainHistory,
  frameworkActivations,
  frameworkDecisions,
  behaviorPatterns,
  pivotReviews,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { BlueprintStatus, PivotReviewStatus } from "@workspace/state-machine";
import { transitionBlueprintToPathSelection } from "../lib/transitionBlueprintToPathSelection.js";
import { evaluatePhaseReadiness } from "../engines/blueprint/PhaseProgressionEngine.js";

export const BlueprintRouteService = {
  async resolveLaunchValidationContract(
    blueprintId: string,
    userId: string,
    hints: { validationContractId?: string; validationId?: string },
  ): Promise<{ contractId: string; selectedPath?: string } | null> {
    if (hints.validationContractId) {
      return { contractId: hints.validationContractId };
    }

    if (hints.validationId) {
      const [byId] = await db
        .select({
          contract_id: validations.contract_id,
          selected_path: validations.selected_path,
        })
        .from(validations)
        .where(and(eq(validations.id, hints.validationId), eq(validations.user_id, userId)))
        .limit(1);
      if (byId) {
        return { contractId: byId.contract_id, selectedPath: byId.selected_path ?? undefined };
      }
    }

    const [latest] = await db
      .select({
        contract_id: validations.contract_id,
        selected_path: validations.selected_path,
      })
      .from(validations)
      .where(and(eq(validations.blueprint_id, blueprintId), eq(validations.user_id, userId)))
      .orderBy(desc(validations.updated_at))
      .limit(1);

    if (!latest) return null;
    return { contractId: latest.contract_id, selectedPath: latest.selected_path ?? undefined };
  },

  async updateProjectName(blueprintId: string, userId: string, projectName: string) {
    const [updated] = await db
      .update(blueprints)
      .set({ project_name: projectName })
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .returning({ id: blueprints.id, project_name: blueprints.project_name });
    if (!updated) {
      throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    }
    return { blueprintId: updated.id, projectName: updated.project_name };
  },

  async selectPath(
    blueprintId: string,
    userId: string,
    selectedPath: "current" | "adjusted" | "alternative",
  ): Promise<{ blueprintId: string; selectedPath: string }> {
    const [bp] = await db
      .select({ id: blueprints.id, validation_id: blueprints.validation_id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) {
      throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    }

    const validationId = bp.validation_id;
    if (!validationId) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Complete validation before selecting a path",
        false,
      );
    }

    const [val] = await db
      .select()
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);
    if (!val || val.user_id !== userId) {
      throw new TorgimaError("NOT_FOUND", "Validation not found", false);
    }

    await db
      .update(blueprints)
      .set({
        selected_path: selectedPath,
        status: BlueprintStatus.PATH_SELECTION,
      })
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)));

    await db
      .update(validations)
      .set({
        selected_path: selectedPath,
        selected_path_type: selectedPath,
        selected_at: new Date(),
      })
      .where(eq(validations.id, validationId));

    await transitionBlueprintToPathSelection({
      blueprintId,
      userId,
      validationId,
      verdict: val.verdict,
      selectedPath,
      realityScore: val.reality_score,
      intelligencePayload: (val.intelligence_payload as Record<string, unknown> | null) ?? null,
      pathOptions: {
        current: val.path_current,
        adjusted: val.path_adjusted,
        alternative: val.path_alternative,
      },
      recommendedTier: val.recommended_blueprint_level ?? "starter",
      validationKind: val.validation_kind,
    });

    return { blueprintId, selectedPath };
  },

  async getPhaseReadiness(blueprintId: string, userId: string) {
    const [bp] = await db
      .select({ currentPhaseId: blueprints.current_phase_id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);

    if (!bp?.currentPhaseId) {
      return {
        canAdvance: false,
        blockers: ["No active phase"],
        completionPercentage: 0,
        currentPhase: null,
        currentPhaseDaysActive: 0,
      };
    }

    const [phase] = await db
      .select({ name: phases.name, started_at: phases.started_at, created_at: phases.created_at })
      .from(phases)
      .where(eq(phases.id, bp.currentPhaseId))
      .limit(1);

    const readiness = await evaluatePhaseReadiness(blueprintId, bp.currentPhaseId);
    const started = phase?.started_at ?? phase?.created_at ?? new Date();
    const daysActive = Math.floor((Date.now() - started.getTime()) / 86400000);

    return {
      ...readiness,
      currentPhase: phase?.name ?? "Active phase",
      currentPhaseDaysActive: daysActive,
    };
  },

  async assertBlueprintOwned(blueprintId: string, userId: string): Promise<void> {
    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) {
      throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    }
  },

  async getExecutionFeed(blueprintId: string, userId: string, limit: number) {
    await BlueprintRouteService.assertBlueprintOwned(blueprintId, userId);
    const feed = await db
      .select({
        id: events.id,
        eventType: events.event_type,
        entityType: events.entity_type,
        entityId: events.entity_id,
        payload: events.payload,
        status: events.status,
        createdAt: events.created_at,
      })
      .from(events)
      .where(eq(events.blueprint_id, blueprintId))
      .orderBy(desc(events.created_at))
      .limit(limit);
    return feed;
  },

  async getDomainHistory(blueprintId: string, userId: string) {
    await BlueprintRouteService.assertBlueprintOwned(blueprintId, userId);
    return db
      .select()
      .from(domainHistory)
      .where(eq(domainHistory.blueprint_id, blueprintId))
      .orderBy(desc(domainHistory.entered_at))
      .limit(20);
  },

  async getFrameworkActivations(blueprintId: string, userId: string) {
    await BlueprintRouteService.assertBlueprintOwned(blueprintId, userId);
    const activations = await db
      .select()
      .from(frameworkActivations)
      .where(eq(frameworkActivations.blueprint_id, blueprintId))
      .orderBy(desc(frameworkActivations.created_at))
      .limit(20);
    const decisions = await db
      .select()
      .from(frameworkDecisions)
      .where(eq(frameworkDecisions.blueprint_id, blueprintId))
      .orderBy(desc(frameworkDecisions.created_at))
      .limit(10);
    return { activations, decisions };
  },

  async getBehaviorPatterns(blueprintId: string, userId: string) {
    await BlueprintRouteService.assertBlueprintOwned(blueprintId, userId);
    return db
      .select()
      .from(behaviorPatterns)
      .where(
        and(eq(behaviorPatterns.user_id, userId), eq(behaviorPatterns.blueprint_id, blueprintId)),
      )
      .orderBy(desc(behaviorPatterns.last_detected_at))
      .limit(30);
  },

  async getPauseStatus(blueprintId: string, userId: string) {
    const [bp] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        paused_at: blueprints.paused_at,
        pause_reason: blueprints.pause_reason,
        goal: blueprints.goal,
      })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) {
      throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    }
    const pauseGapDays = bp.paused_at
      ? Math.floor((Date.now() - bp.paused_at.getTime()) / 86400000)
      : 0;
    const resumeMode =
      pauseGapDays <= 2
        ? "normal"
        : pauseGapDays <= 7
          ? "check_in"
          : pauseGapDays <= 30
            ? "recovery"
            : "restart";
    return { bp, pauseGapDays, resumeMode };
  },

  async getCurrentPivotReview(blueprintId: string, userId: string) {
    const [review] = await db
      .select()
      .from(pivotReviews)
      .where(
        and(
          eq(pivotReviews.blueprint_id, blueprintId),
          eq(pivotReviews.user_id, userId),
          eq(pivotReviews.status, PivotReviewStatus.OPEN),
        ),
      )
      .limit(1);
    return review ?? null;
  },

  async getAllActiveBlueprints() {
    return db
      .select({
        id: blueprints.id,
        user_id: blueprints.user_id,
        status: blueprints.status,
        active: blueprints.active,
      })
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
  },
};
