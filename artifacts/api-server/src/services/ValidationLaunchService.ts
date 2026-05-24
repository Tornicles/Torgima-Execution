import { db, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { BlueprintLaunchService, type LaunchPathType } from "./BlueprintLaunchService.js";
import { BlueprintService } from "./BlueprintService.js";
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
  redirect_to: "/orders";
  launched: true;
  idempotent?: boolean;
}

function resolvePath(input: ValidationLaunchInput, row: typeof validations.$inferSelect): LaunchPathType {
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
  row: typeof validations.$inferSelect,
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
    const [row] = await db
      .select()
      .from(validations)
      .where(and(eq(validations.id, input.validationId), eq(validations.user_id, input.userId)))
      .limit(1);

    if (!row) {
      throw new TorgimaError("NOT_FOUND", `Validation not found: ${input.validationId}`);
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
        validationId: input.validationId,
        blueprintId: row.blueprint_id,
        selectedDirectionPresent: Boolean(input.selectedDirection),
        selectedPath: selectedPathType,
        tier,
        mode,
      },
      "Validation launch route — starting blueprint activation",
    );

    await BlueprintService.configureSelection(row.blueprint_id, input.userId, { tier, mode });

    let idempotent = false;
    try {
      await BlueprintLaunchService.launch({
        blueprintId: row.blueprint_id,
        userId: input.userId,
        validationContractId: row.contract_id,
        selectedPathType,
        selectedBlueprintLevel: tier,
      });
    } catch (err) {
      if (err instanceof TorgimaError && err.code === "BLUEPRINT_ALREADY_ACTIVE") {
        idempotent = true;
        logger.info(
          { validationId: input.validationId, blueprintId: row.blueprint_id },
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
        validationId: input.validationId,
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
      redirect_to: "/orders",
      launched: true,
      ...(idempotent ? { idempotent: true } : {}),
    };
  },
};
