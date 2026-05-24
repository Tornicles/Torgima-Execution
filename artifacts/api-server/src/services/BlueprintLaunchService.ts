import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { TorgimaError } from "../lib/errors.js";
import { verifyBlueprintLaunchSchema } from "../lib/verifySchema.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { ValidationService } from "./ValidationService.js";
import { BlueprintStatus, ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import type { BlueprintTier } from "../engines/blueprint/infrastructure/blueprint-types.js";

function assertValidationReadyForLaunch(row: Awaited<ReturnType<typeof ValidationService.getValidationByContractId>>): void {
  const selected = row.selected_path_type ?? row.selected_path;
  if (!selected) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "validation_required: Select a validation path before launch.",
      false,
    );
  }
  const stage = row.erector_validation_stage ?? row.validation_stage ?? row.status;
  if (row.validation_kind === ValidationKind.ERECTOR) {
    const complete =
      stage === ErectorValidationStage.COMPLETE ||
      stage === ValidationStatus.COMPLETE ||
      stage === "complete";
    if (!complete) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "validation_required: Erector validation must complete before launch.",
        false,
      );
    }
  }
}

export type LaunchPathType = "current" | "adjusted" | "alternative";

export interface LaunchInput {
  blueprintId: string;
  userId: string;
  validationContractId: string;
  selectedPathType: LaunchPathType;
  selectedBlueprintLevel?: "starter" | "growth" | "ultimate";
}

export interface LaunchResult {
  launched: true;
  blueprintId: string;
}

const blueprintEngine = new BlueprintEngine();

export const BlueprintLaunchService = {
  async launch(input: LaunchInput): Promise<LaunchResult> {
    const schemaCheck = await verifyBlueprintLaunchSchema();
    if (!schemaCheck.ok) {
      throw new TorgimaError(
        "SCHEMA_OUT_OF_DATE",
        schemaCheck.detail ?? "Missing blueprint launch schema requirement",
        true,
      );
    }

    const blueprint = await BlueprintRepository.findById(input.blueprintId, input.userId);
    if (blueprint.status === BlueprintStatus.ACTIVE) {
      throw new TorgimaError("BLUEPRINT_ALREADY_ACTIVE", "Blueprint is already active");
    }

    const selectedPathType = input.selectedPathType ?? "current";
    const selectedBlueprintLevel = (input.selectedBlueprintLevel ??
      blueprint.selected_blueprint_level ??
      blueprint.tier ??
      "starter") as BlueprintTier;

    const validationRow = await ValidationService.getValidationByContractId(input.validationContractId);
    if (validationRow.blueprint_id !== input.blueprintId || validationRow.user_id !== input.userId) {
      throw new TorgimaError("FORBIDDEN", "validation_contract_id does not belong to this blueprint");
    }
    assertValidationReadyForLaunch(validationRow);

    if (selectedBlueprintLevel) {
      await blueprintEngine.configureSelection(input.blueprintId, input.userId, {
        tier: selectedBlueprintLevel,
        mode: blueprint.mode ?? "individual",
      });
    }

    await ValidationService.selectValidationPath({
      blueprintId: input.blueprintId,
      userId: input.userId,
      selectedPath: selectedPathType,
      validationContractId: input.validationContractId,
      confirmAdjusted: selectedPathType === "adjusted",
    });

    await ValidationService.assertLaunchAllowed(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );

    await db
      .update(blueprints)
      .set({
        selected_path: selectedPathType,
        selected_blueprint_level: selectedBlueprintLevel,
        validation_id: validationRow.id,
        ...(validationRow.validation_kind === ValidationKind.ERECTOR
          ? { erector_validation_id: validationRow.id }
          : {}),
      })
      .where(eq(blueprints.id, input.blueprintId));

    return blueprintEngine.activateBlueprint(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );
  },
};
