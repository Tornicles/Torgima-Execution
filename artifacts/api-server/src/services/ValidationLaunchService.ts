import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { BlueprintLaunchService, type LaunchPathType } from "./BlueprintLaunchService.js";
import { BlueprintService } from "./BlueprintService.js";
import { ValidationService } from "./ValidationService.js";
import { ValidationFinalizationService } from "./ValidationFinalizationService.js";
import type { Blueprint } from "../types/blueprint.js";
import { ensureActiveOrder } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { dispatchPendingEvents } from "./EventDispatcher.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";

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
}

function resolvePath(
  input: ValidationLaunchInput,
  row: NonNullable<Awaited<ReturnType<typeof ValidationService.findValidationForBlueprint>>>,
): LaunchPathType {
  const fromDirection = input.selectedDirection?.path ?? input.selectedDirection?.selectedPath;
  const path = input.selectedPath ?? fromDirection ?? row.selected_path_type ?? row.selected_path;
  if (!path || !["current", "adjusted", "alternative"].includes(path)) {
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
    row.recommended_blueprint_level ??
    row.selected_blueprint_tier ??
    "starter";
  if (raw === "growth" || raw === "ultimate" || raw === "starter") return raw;
  return "starter";
}

export const ValidationLaunchService = {
  async launch(input: ValidationLaunchInput): Promise<ValidationLaunchResult> {
    logger.info(
      { validationId: input.validationId, userId: input.userId },
      "[LAUNCH] ValidationLaunchService — resolving validation row",
    );

    const row = await ValidationService.findValidationForBlueprint({
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
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "validation_required: complete validation before launching",
        false,
      );
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

    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await db
      .update(validations)
      .set({
        selected_blueprint_tier: tier,
        selected_path_type: selectedPathType,
        selected_path: selectedPathType,
      })
      .where(eq(validations.id, row.id));

    let idempotent = false;
    try {
      const launchResult = await BlueprintLaunchService.launch({
        blueprintId: row.blueprint_id,
        userId: input.userId,
        validationContractId: row.contract_id,
        selectedPathType,
        selectedBlueprintLevel: tier,
      });
      logger.info(
        { blueprintId: launchResult.blueprintId, validationId: row.id },
        "Validation launch — BlueprintEngine.activateBlueprint completed",
      );
    } catch (err) {
      if (err instanceof TorgimaError && err.code === "BLUEPRINT_ALREADY_ACTIVE") {
        idempotent = true;
        logger.info(
          { validationId: row.id, blueprintId: row.blueprint_id },
          "Validation launch — blueprint already active (idempotent)",
        );
      } else {
        throw err;
      }
    }

    const blueprint = await BlueprintService.get(row.blueprint_id, input.userId);

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

    await dispatchPendingEvents().catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[BlueprintLaunch] Event dispatch after launch failed (non-fatal)",
      );
    });

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
      ...(idempotent ? { idempotent: true } : {}),
    };
  },
};
