import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { BlueprintLaunchService, type LaunchPathType } from "./BlueprintLaunchService.js";
import { BlueprintService } from "./BlueprintService.js";
import { ValidationService } from "./ValidationService.js";
import type { Blueprint } from "../types/blueprint.js";

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
    row.recommended_blueprint_level ??
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
