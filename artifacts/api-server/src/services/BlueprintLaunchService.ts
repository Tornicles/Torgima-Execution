import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { TorgimaError } from "../lib/errors.js";
import { verifyBlueprintLaunchSchema } from "../lib/verifySchema.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { ValidationService } from "./ValidationService.js";
import { BlueprintStatus, ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { SequenceTrackingService } from "./SequenceTrackingService.js";
import { recordExecutionStructureFromBlueprint } from "../engines/sequence/sequenceExecutionStructureService.js";
import { syncTaskGenerationSequence } from "../engines/sequence/sequenceTaskQueueService.js";
import { initializeStarterAllocation } from "../engines/mini-plan/MiniPlanAllocationEngine.js";
import { fillBlueprintTaskQueue } from "../engines/task-engine/TaskEngine.js";
import { initializePermanentFrameworkSignals } from "./PermanentFrameworkSignalService.js";
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

    const usesTwentyStage =
      validationRow.validation_version != null || validationRow.stage_final_decision != null;
    if (usesTwentyStage && !validationRow.is_finalized) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Validation must be finalized before blueprint launch. Complete the workspace and finalize first.",
        false,
      );
    }

    await blueprintEngine.configureSelection(input.blueprintId, input.userId, {
      tier: selectedBlueprintLevel,
      mode: blueprint.mode ?? "individual",
    });

    await ValidationService.selectValidationPath({
      blueprintId: input.blueprintId,
      userId: input.userId,
      selectedPath: selectedPathType,
      validationContractId: input.validationContractId,
      validationIdHint: validationRow.id,
      confirmAdjusted: selectedPathType === "adjusted",
    });

    await ValidationService.assertLaunchAllowed(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );

    const handoff = validationRow.handoff_package as Record<string, unknown> | null;
    const goalFromHandoff = (handoff?.goal_final as string) ?? validationRow.goal_final;
    const purposeFromHandoff = (handoff?.purpose_final as string) ?? validationRow.purpose_final;

    await db
      .update(blueprints)
      .set({
        goal: goalFromHandoff ?? blueprint.goal,
        purpose: purposeFromHandoff ?? blueprint.purpose,
        goal_final: goalFromHandoff ?? blueprint.goal_final,
        purpose_final: purposeFromHandoff ?? blueprint.purpose_final,
        economic_type: (handoff?.economic_type as string) ?? validationRow.economic_type,
        selected_path: selectedPathType,
        selected_blueprint_level: selectedBlueprintLevel,
        validation_id: validationRow.id,
        ...(validationRow.validation_kind === ValidationKind.ERECTOR
          ? { erector_validation_id: validationRow.id }
          : {}),
      })
      .where(eq(blueprints.id, input.blueprintId));

    await SequenceTrackingService.recordBlueprintTier(input.blueprintId, selectedBlueprintLevel).catch(() => null);
    await SequenceTrackingService.recordLaunchStack(input.blueprintId, selectedBlueprintLevel, {
      goal: validationRow.goal_final ?? blueprint.goal_final ?? blueprint.goal,
      purpose: validationRow.purpose_final ?? blueprint.purpose_final ?? blueprint.purpose ?? undefined,
      selectedPath: selectedPathType,
    }).catch(() => null);

    const result = await blueprintEngine.activateBlueprint(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );

    await recordExecutionStructureFromBlueprint(input.blueprintId, selectedBlueprintLevel).catch(() => null);
    await initializePermanentFrameworkSignals(input.blueprintId).catch(() => null);
    await initializeStarterAllocation(input.blueprintId, input.userId).catch(() => null);
    await fillBlueprintTaskQueue({
      blueprintId: input.blueprintId,
      userId: input.userId,
      tier: selectedBlueprintLevel,
      generationMode: "initial",
      generationTrigger: "blueprint_launched",
    }).catch(() => null);
    await syncTaskGenerationSequence(input.blueprintId, selectedBlueprintLevel).catch(() => null);

    return result;
  },
};
