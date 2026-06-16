import { blueprints, db, users } from "@workspace/db";
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
import { isSignalAutoBootstrapEnabled } from "../lib/launch-mode.js";
import { SequenceTracker } from "../engines/sequence/SequenceTracker.js";
import { KnowledgeService } from "../engines/growth/KnowledgeService.js";
import type { BlueprintTier } from "../engines/blueprint/infrastructure/blueprint-types.js";
import {
  normalizeSelectedPath,
  resolveDefaultSelectedPath,
  type ValidationPathType,
} from "../lib/validationPathSelection.js";
import {
  requiresLaunchFinalization,
  ValidationFinalizationService,
} from "./ValidationFinalizationService.js";
import { ensureBlueprintReadyForLaunch } from "../lib/transitionBlueprintToPathSelection.js";
import {
  enforceLaunchContract,
  markContractConsumed,
} from "../engines/erector/LaunchContractEnforcer.js";
import { transition } from "../engines/erector/erectorStateMachine.js";
import { injectErectorIntelligence } from "./erector/blueprint-feed-service.js";

function assertValidationReadyForLaunch(
  row: Awaited<ReturnType<typeof ValidationService.getValidationByContractId>>,
  launchPath?: ValidationPathType,
): void {
  const selected =
    normalizeSelectedPath(row, launchPath) ?? resolveDefaultSelectedPath(row.verdict);
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

    const launchEnforcement = await enforceLaunchContract(input.blueprintId, input.userId);
    if (!launchEnforcement.permitted) {
      throw new TorgimaError(
        "FORBIDDEN",
        launchEnforcement.user_message ?? "Launch blocked by Project Intelligence contract.",
        false,
      );
    }

    const selectedBlueprintLevel = (input.selectedBlueprintLevel ??
      blueprint.selected_blueprint_level ??
      blueprint.tier ??
      "starter") as BlueprintTier;

    let validationRow = await ValidationService.getValidationByContractId(input.validationContractId);
    if (validationRow.blueprint_id !== input.blueprintId || validationRow.user_id !== input.userId) {
      throw new TorgimaError("FORBIDDEN", "validation_contract_id does not belong to this blueprint");
    }

    const selectedPathType: LaunchPathType =
      input.selectedPathType ??
      normalizeSelectedPath(validationRow) ??
      resolveDefaultSelectedPath(validationRow.verdict);

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

    await ValidationFinalizationService.finalizeValidation(validationRow.id, input.userId, {
      selectedPath: selectedPathType,
    });

    validationRow = await ValidationService.getValidationByContractId(input.validationContractId);

    await ensureBlueprintReadyForLaunch(input.blueprintId, input.userId, validationRow);

    if (requiresLaunchFinalization(validationRow)) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Validation must be finalized before blueprint launch. Complete the workspace and finalize first.",
        false,
      );
    }

    assertValidationReadyForLaunch(validationRow, selectedPathType);

    await ValidationService.assertLaunchAllowed(
      input.blueprintId,
      input.userId,
      input.validationContractId,
    );

    const blueprintSource =
      validationRow.validation_kind === ValidationKind.ERECTOR
        ? "erector_authenticated"
        : "onboarding";

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
        tier: selectedBlueprintLevel,
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

    await db
      .update(blueprints)
      .set({ blueprint_source: blueprintSource })
      .where(eq(blueprints.id, input.blueprintId));

    if (launchEnforcement.contract_id) {
      await injectErectorIntelligence(
        input.blueprintId,
        launchEnforcement.contract_id,
        input.userId,
      );
    }

    await transition(
      input.blueprintId,
      input.userId,
      "BLUEPRINT_ACTIVE",
      "blueprint_activation",
    );

    if (launchEnforcement.contract_id) {
      await markContractConsumed(launchEnforcement.contract_id);
    }

    await db
      .update(users)
      .set({ dashboard_mode: "full" })
      .where(eq(users.id, input.userId));

    await recordExecutionStructureFromBlueprint(input.blueprintId, selectedBlueprintLevel).catch(() => null);
    // Signal auto-bootstrap is gated behind ENABLE_SIGNAL_AUTO_BOOTSTRAP.
    // In launch mode (false by default) signals load lazily when the user
    // visits the Signals page — no subrequest budget consumed at launch time.
    if (isSignalAutoBootstrapEnabled()) {
      await initializePermanentFrameworkSignals(input.blueprintId).catch(() => null);
    }
    await initializeStarterAllocation(input.blueprintId, input.userId).catch(() => null);
    await fillBlueprintTaskQueue({
      blueprintId: input.blueprintId,
      userId: input.userId,
      tier: selectedBlueprintLevel,
      generationMode: "initial",
      generationTrigger: "blueprint_launched",
    }).catch(() => null);
    await syncTaskGenerationSequence(input.blueprintId, selectedBlueprintLevel).catch(() => null);

    await SequenceTracker.recordCheckpoint(input.blueprintId, 1, {
      userAction: "Blueprint launched",
      stateSnapshot: {
        goal: goalFromHandoff ?? blueprint.goal_final,
        purpose: purposeFromHandoff ?? blueprint.purpose_final,
        tier: selectedBlueprintLevel,
        selectedPath: selectedPathType,
      },
      validationPassed: true,
    }).catch(() => null);
    await SequenceTracker.advanceSequence(input.blueprintId, "Automatic: Blueprint launch").catch(
      () => null,
    );
    for (const seqNum of [6, 7, 8, 9, 10, 11, 16] as const) {
      await SequenceTracker.recordCheckpoint(input.blueprintId, seqNum, {
        userAction: "Blueprint launch stack",
        validationPassed: true,
      }).catch(() => null);
    }

    if (selectedBlueprintLevel === "growth" || selectedBlueprintLevel === "ultimate") {
      await KnowledgeService.seedKnowledgeCards(input.blueprintId, selectedBlueprintLevel).catch(
        () => null,
      );
    }

    return result;
  },
};
