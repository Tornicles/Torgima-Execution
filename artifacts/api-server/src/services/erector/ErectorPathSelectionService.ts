import { and, eq } from "drizzle-orm";
import {
  db,
  erectorBlueprintLaunchContracts,
  erectorValidationRuns,
} from "@workspace/db";
import { TorgimaError } from "../../lib/errors.js";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";
import { mapIntakeTierToMatrixTier } from "../../engines/erector/ValidationScoringEngine.js";
import { updateBlueprintErectorState } from "../../engines/erector/erectorStateMachine.js";
import { setLaunchContractPermitted } from "../../engines/erector/LaunchContractEnforcer.js";

export type SelectedPath = "current" | "adjusted" | "alternative";

export async function selectValidationPath(input: {
  validationRunId: string;
  userId: string;
  selectedPath: SelectedPath;
}): Promise<{ path_selected: SelectedPath; next_step: "simulation" | "launch" | "correction" }> {
  const [run] = await db
    .select()
    .from(erectorValidationRuns)
    .where(
      and(
        eq(erectorValidationRuns.id, input.validationRunId),
        eq(erectorValidationRuns.user_id, input.userId),
      ),
    )
    .limit(1);

  if (!run) throw new TorgimaError("NOT_FOUND", "Validation run not found");

  if (run.verdict === "PIVOT" && input.selectedPath === "current") {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "Current path cannot be selected when verdict is PIVOT",
    );
  }

  if (run.verdict === "ADJUST" && input.selectedPath === "current") {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "Current path requires corrections before selection",
    );
  }

  await db
    .update(erectorValidationRuns)
    .set({ selected_path: input.selectedPath })
    .where(eq(erectorValidationRuns.id, input.validationRunId));

  if (run.blueprint_id) {
    await db
      .update(erectorBlueprintLaunchContracts)
      .set({ selected_path: input.selectedPath })
      .where(
        and(
          eq(erectorBlueprintLaunchContracts.validation_run_id, input.validationRunId),
          eq(erectorBlueprintLaunchContracts.consumed, false),
        ),
      );

    await updateBlueprintErectorState(run.blueprint_id, "PATH_SELECTED");
  }

  const matrixTier = mapIntakeTierToMatrixTier(run.tier);
  const simulationRequired = matrixTier !== "starter" && run.verdict === "PROCEED";

  if (run.verdict === "ADJUST") {
    return { path_selected: input.selectedPath, next_step: "correction" };
  }

  if (simulationRequired) {
    if (run.blueprint_id) {
      await updateBlueprintErectorState(run.blueprint_id, "SIMULATION_REQUIRED");
    }
    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_SIMULATION_REQUESTED,
      entityType: "erector_validation_run",
      entityId: input.validationRunId,
      userId: input.userId,
      blueprintId: run.blueprint_id ?? undefined,
      payload: {
        validation_run_id: input.validationRunId,
        selected_path: input.selectedPath,
      },
      idempotencyKey: `erector_simulation_requested:${input.validationRunId}:${input.selectedPath}`,
    });
    return { path_selected: input.selectedPath, next_step: "simulation" };
  }

  if (run.blueprint_id) {
    await updateBlueprintErectorState(run.blueprint_id, "LAUNCH_PERMITTED");
    await setLaunchContractPermitted(run.blueprint_id);
  }

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_LAUNCH_PERMITTED,
    entityType: "erector_validation_run",
    entityId: input.validationRunId,
    userId: input.userId,
    blueprintId: run.blueprint_id ?? undefined,
    payload: {
      validation_run_id: input.validationRunId,
      selected_path: input.selectedPath,
    },
    idempotencyKey: `erector_launch_permitted:${input.validationRunId}:${input.selectedPath}`,
  });

  return { path_selected: input.selectedPath, next_step: "launch" };
}
