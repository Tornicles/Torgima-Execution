import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { isLaunchMode } from "../lib/launch-mode.js";
import { launchDefaultPath, launchDefaultTier, shouldDegradeOnFailure } from "../lib/systemResilience.js";
import { activateMinimalLaunchBlueprint } from "../engines/launch/LaunchModeBlueprintEngine.js";
import { type LaunchPathType } from "./BlueprintLaunchService.js";
import { BlueprintTierLaunchService } from "./BlueprintTierLaunchService.js";
import { BlueprintService } from "./BlueprintService.js";
import { ValidationService } from "./ValidationService.js";
import { ValidationFinalizationService } from "./ValidationFinalizationService.js";
import type { Blueprint } from "../types/blueprint.js";
import { ensureActiveOrder } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { PlatformUpgradeService } from "./PlatformUpgradeService.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import { dispatchPendingEvents } from "./EventDispatcher.js";
import { generateInitialTasks } from "../engines/tasks/generateInitialTasks.js";
import { normalizeProjectName } from "../lib/projectName.js";
import { ensureBlueprintReadyForLaunch } from "../lib/transitionBlueprintToPathSelection.js";
import { ensureBlueprintSelectionBeforeActivate } from "../lib/ensureBlueprintSelectionBeforeActivate.js";
import { intelligenceDepthForTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import { BlueprintStatus } from "@workspace/state-machine";

export type SelectedDirection = {
  path?: LaunchPathType;
  selectedPath?: LaunchPathType;
  tier?: "starter" | "growth" | "ultimate";
  blueprint_level?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
};

export interface ValidationLaunchInput {
  validationId: string;
  userId: string;
  selectedDirection?: SelectedDirection;
  selectedPath?: LaunchPathType;
  tier?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
  projectName?: string;
  blueprintId?: string;
}

export interface ValidationLaunchResult {
  success: true;
  blueprint: Blueprint;
  blueprintId: string;
  validationId: string;
  redirectTo: "/dashboard";
  redirect_to: "/dashboard";
  launched: true;
  idempotent?: boolean;
  tier?: "starter" | "growth" | "ultimate";
  generationSummary?: {
    plansCreated: number;
    seasonsCreated: number;
    targetsCreated: number;
    phasesCreated: number;
    actionsCreated: number;
    durationMs: number;
  };
}

function resolvePath(
  input: ValidationLaunchInput,
  row: NonNullable<Awaited<ReturnType<typeof ValidationService.findValidationForBlueprint>>>,
): LaunchPathType {
  const fromDirection = input.selectedDirection?.path ?? input.selectedDirection?.selectedPath;
  const path = input.selectedPath ?? fromDirection ?? row.selected_path_type ?? row.selected_path;
  if (!path || !["current", "adjusted", "alternative"].includes(path)) {
    if (isLaunchMode()) {
      return launchDefaultPath();
    }
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "selected_direction.path is required (current, adjusted, or alternative)",
      false,
    );
  }
  return path as LaunchPathType;
}

function resolveTier(
  input: ValidationLaunchInput,
  row: NonNullable<Awaited<ReturnType<typeof ValidationService.findValidationForBlueprint>>>,
): "starter" | "growth" | "ultimate" {
  const raw =
    input.tier ??
    input.selectedDirection?.tier ??
    input.selectedDirection?.blueprint_level ??
    (input.selectedDirection as { blueprint_type?: string } | undefined)?.blueprint_type ??
    row.selected_blueprint_tier ??
    row.recommended_blueprint_level ??
    null;
  if (raw === "growth" || raw === "ultimate" || raw === "starter") return raw;
  if (isLaunchMode()) {
    return launchDefaultTier();
  }
  throw new TorgimaError(
    "VALIDATION_ERROR",
    "Please select an execution level (Starter, Growth, or Ultimate) before launch.",
    false,
  );
}

export const ValidationLaunchService = {
  async launch(input: ValidationLaunchInput): Promise<ValidationLaunchResult> {
    logger.info(
      { validationId: input.validationId, userId: input.userId },
      "[LAUNCH] ValidationLaunchService — resolving validation row",
    );

    let row = await ValidationService.findValidationForBlueprint({
      blueprintId: "",
      userId: input.userId,
      validationIdHint: input.validationId,
    });

    if (!row) {
      throw new TorgimaError("NOT_FOUND", "Validation record not found. Run validation first.");
    }
    if (!row.blueprint_id) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation has no linked blueprint", false);
    }
    if (!row.contract_id) {
      const { db, validations } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const { randomUUID } = await import("crypto");
      const [patched] = await db
        .update(validations)
        .set({ contract_id: randomUUID() })
        .where(eq(validations.id, row.id))
        .returning();
      if (patched?.contract_id) {
        row = patched;
      } else {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          "validation_required: complete validation before launching",
          false,
        );
      }
    }

    const selectedPathType = resolvePath(input, row);
    const tier = resolveTier(input, row);
    const mode = input.mode ?? input.selectedDirection?.mode ?? "individual";

    logger.info(
      {
        event: "validation.launch",
        userId: input.userId,
        validationId: row.id,
        blueprintId: row.blueprint_id,
        selectedDirectionPresent: Boolean(input.selectedDirection),
        selectedPath: selectedPathType,
        tier,
        mode,
        validationKind: row.validation_kind,
      },
      "Validation launch — starting blueprint activation",
    );

    await ValidationService.selectValidationPath({
      blueprintId: row.blueprint_id,
      userId: input.userId,
      selectedPath: selectedPathType,
      validationContractId: row.contract_id,
      validationIdHint: row.id,
      confirmAdjusted: selectedPathType === "adjusted",
    });

    await ValidationFinalizationService.finalizeValidation(row.id, input.userId, {
      selectedPath: selectedPathType,
    });

    const validationRow = await ValidationService.getValidationByContractId(row.contract_id!);
    try {
      await ensureBlueprintReadyForLaunch(row.blueprint_id, input.userId, validationRow);
    } catch (launchPrepErr: unknown) {
      const msg = launchPrepErr instanceof Error ? launchPrepErr.message : String(launchPrepErr);
      if (shouldDegradeOnFailure(launchPrepErr)) {
        logger.warn({ blueprintId: row.blueprint_id, msg }, "[LAUNCH] Pre-launch check degraded — continuing");
      } else {
        logger.error({ blueprintId: row.blueprint_id, msg }, "[LAUNCH] Blueprint pre-launch check failed");
        throw new TorgimaError("VALIDATION_ERROR", msg.replace(/^\[LAUNCH\]\s*/, ""), false);
      }
    }

    const { db, validations, blueprints: blueprintsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const depth = intelligenceDepthForTier(tier);
    await db
      .update(blueprintsTable)
      .set({
        status: BlueprintStatus.PATH_SELECTION,
        tier,
        mode: mode ?? "individual",
        selected_path: selectedPathType,
        selected_blueprint_level: tier,
        blueprint_tier: tier,
        intelligence_depth: depth,
      })
      .where(and(eq(blueprintsTable.id, row.blueprint_id), eq(blueprintsTable.user_id, input.userId)));

    await ensureBlueprintSelectionBeforeActivate(row.blueprint_id, input.userId, {
      tier,
      mode: mode ?? "individual",
    });

    await db
      .update(validations)
      .set({
        selected_blueprint_tier: tier,
        selected_path_type: selectedPathType,
        selected_path: selectedPathType,
      })
      .where(eq(validations.id, row.id));

    let idempotent = false;
    let generationSummary: ValidationLaunchResult["generationSummary"];
    try {
      const launchResult = await BlueprintTierLaunchService.selectTierAndLaunch({
        blueprintId: row.blueprint_id,
        validationId: row.id,
        userId: input.userId,
        selectedTier: tier,
        selectedPath: selectedPathType,
      });
      generationSummary = launchResult.generationSummary;
      logger.info(
        { blueprintId: launchResult.blueprintId, validationId: row.id, tier },
        "Validation launch — tier chain generated and blueprint activated",
      );
    } catch (err) {
      if (err instanceof TorgimaError && err.code === "BLUEPRINT_ALREADY_ACTIVE") {
        idempotent = true;
        logger.info(
          { validationId: row.id, blueprintId: row.blueprint_id },
          "Validation launch — blueprint already active (idempotent)",
        );
      } else if (shouldDegradeOnFailure(err)) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[LAUNCH] Tier launch failed — minimal launch fallback",
        );
        if (row.contract_id) {
          const minimal = await activateMinimalLaunchBlueprint({
            blueprintId: row.blueprint_id,
            validationId: row.id,
            userId: input.userId,
            selectedTier: tier,
            selectedPath: selectedPathType,
            validationContractId: row.contract_id,
          });
          generationSummary = minimal.generationSummary;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (input.projectName?.trim()) {
      const { blueprints: blueprintsTable } = await import("@workspace/db");
      await db
        .update(blueprintsTable)
        .set({
          project_name: normalizeProjectName(input.projectName, row.domain ?? undefined),
        })
        .where(eq(blueprintsTable.id, row.blueprint_id));
    }

    const blueprint = await BlueprintService.get(row.blueprint_id, input.userId);

    const [freshValidation] = await db
      .select()
      .from(validations)
      .where(eq(validations.id, row.id))
      .limit(1);

    if (freshValidation) {
      try {
        const taskCount = await generateInitialTasks({
          blueprintId: row.blueprint_id,
          userId: input.userId,
          validation: freshValidation,
          selectedPath: selectedPathType,
        });
        logger.info(
          { blueprintId: row.blueprint_id, taskCount },
          "[LAUNCH] 8 initial tasks generated for blueprint",
        );
        await db
          .update(validations)
          .set({
            is_finalized: true,
            finalized_at: new Date(),
            launch_blocked: false,
          })
          .where(eq(validations.id, row.id));
      } catch (taskErr: unknown) {
        const message = taskErr instanceof Error ? taskErr.message : String(taskErr);
        logger.warn({ err: message }, "[LAUNCH] Task generation error (non-fatal)");
        logger.warn({ blueprintId: row.blueprint_id, message }, "[LAUNCH] Initial task generation failed");
      }
    }

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: row.blueprint_id,
      userId: input.userId,
      blueprintId: row.blueprint_id,
      payload: {
        trigger: "blueprint_launch",
        force: true,
        generation_mode: "initial",
      },
      idempotencyKey: `task_gen_launch:${row.blueprint_id}`,
    }).catch(() => null);

    const ensured = await ensureActiveOrder(input.userId);
    logger.info(
      {
        blueprintId: row.blueprint_id,
        orderId: ensured.orderId,
        taskTypeGenerated: ensured.taskTypeGenerated,
      },
      "[BlueprintLaunch] Task generation job queued / order ensured after launch",
    );

    await dispatchPendingEvents().catch((err: unknown) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[BlueprintLaunch] Event dispatch after launch failed (non-fatal)",
      );
    });

    await PlatformUpgradeService.completeUpgradeAfterLaunch(input.userId, row.blueprint_id).catch(() => null);

    logger.info(
      {
        event: "validation.launch.complete",
        userId: input.userId,
        validationId: row.id,
        blueprintId: row.blueprint_id,
        selectedPath: selectedPathType,
        tier,
        idempotent,
      },
      "Validation launch — blueprint chain generated",
    );

    return {
      success: true,
      blueprint,
      blueprintId: row.blueprint_id,
      validationId: row.id,
      redirectTo: "/dashboard",
      redirect_to: "/dashboard",
      launched: true,
      tier,
      ...(generationSummary ? { generationSummary } : {}),
      ...(idempotent ? { idempotent: true } : {}),
    };
  },
};
