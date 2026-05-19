import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { TorgimaError } from "../lib/errors.js";
import { verifyBlueprintLaunchSchema } from "../lib/verifySchema.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { ValidationService } from "./ValidationService.js";
import { BlueprintStatus } from "@workspace/state-machine";

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

    const validationRow = await ValidationService.getValidationByContractId(input.validationContractId);
    if (validationRow.blueprint_id !== input.blueprintId || validationRow.user_id !== input.userId) {
      throw new TorgimaError("FORBIDDEN", "validation_contract_id does not belong to this blueprint");
    }

    if (input.selectedBlueprintLevel) {
      await blueprintEngine.configureSelection(input.blueprintId, input.userId, {
        tier: input.selectedBlueprintLevel,
        mode: blueprint.mode ?? "individual",
      });
    }

    await ValidationService.selectValidationPath({
      blueprintId: input.blueprintId,
      userId: input.userId,
      selectedPath: input.selectedPathType,
      validationContractId: input.validationContractId,
      confirmAdjusted: input.selectedPathType === "adjusted",
    });

    await ValidationService.assertLaunchAllowed(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );

    await db
      .update(blueprints)
      .set({
        selected_path: input.selectedPathType,
        selected_blueprint_level: input.selectedBlueprintLevel ?? blueprint.selected_blueprint_level,
      })
      .where(eq(blueprints.id, input.blueprintId));

    return blueprintEngine.activateBlueprint(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );
  },
};
