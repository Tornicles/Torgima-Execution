import { db, validationPaths, validationRuns, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { ValidationLaunchService } from "../../services/ValidationLaunchService.js";

export const ValidationBridgeService = {
  async launchBlueprint(input: {
    validation_run_id: string;
    user_id: string;
    tier?: "starter" | "growth" | "ultimate";
    mode?: "individual" | "team";
  }): Promise<{ blueprint_id: string; redirect_to: string }> {
    const [run] = await db
      .select()
      .from(validationRuns)
      .where(
        and(eq(validationRuns.id, input.validation_run_id), eq(validationRuns.user_id, input.user_id)),
      )
      .limit(1);

    if (!run) throw new TorgimaError("NOT_FOUND", "Validation run not found", false);
    if (run.status !== "complete") {
      throw new TorgimaError("VALIDATION_ERROR", "Validation must complete before launch", false);
    }
    if (run.blueprint_launched && run.launched_blueprint_id) {
      return {
        blueprint_id: run.launched_blueprint_id,
        redirect_to: `/dashboard?blueprint_id=${run.launched_blueprint_id}`,
      };
    }
    if (!run.selected_path) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "User must select a path before launching blueprint",
        false,
      );
    }
    if (run.verdict === "pivot") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Cannot launch blueprint when validation verdict is pivot — adjust the idea first",
        false,
      );
    }

    const blueprintId = run.blueprint_draft_id;
    if (!blueprintId) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation run has no linked blueprint", false);
    }

    let launchedBlueprintId = blueprintId;

    const validationId =
      run.legacy_validation_id ??
      (
        await db
          .select({ id: validations.id })
          .from(validations)
          .where(eq(validations.blueprint_id, blueprintId))
          .limit(1)
      )[0]?.id;

    if (!validationId) {
      throw new TorgimaError("VALIDATION_ERROR", "No validation record linked to blueprint", false);
    }

    const [legacy] = await db
      .select({ contract_id: validations.contract_id })
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);

    if (!legacy?.contract_id) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation contract missing", false);
    }

    await db
      .update(validations)
      .set({
        selected_path: run.selected_path as typeof validations.$inferInsert["selected_path"],
        selected_path_type: run.selected_path,
        selected_at: new Date(),
      })
      .where(eq(validations.id, validationId));

    const launch = await ValidationLaunchService.launch({
      validationId,
      userId: input.user_id,
      selectedPath: run.selected_path as "current" | "adjusted" | "alternative",
      tier: input.tier ?? "starter",
      mode: input.mode,
      blueprintId,
    });
    launchedBlueprintId = launch.blueprintId;

    const [selectedPathRow] = await db
      .select()
      .from(validationPaths)
      .where(
        and(
          eq(validationPaths.validation_run_id, run.id),
          eq(validationPaths.path_type, run.selected_path),
        ),
      )
      .limit(1);

    await db
      .update(validationRuns)
      .set({
        blueprint_launched: true,
        launched_blueprint_id: launchedBlueprintId,
        launched_at: new Date(),
        is_direction_anchor: true,
      })
      .where(eq(validationRuns.id, run.id));

    await writeEvent({
      eventType: EVENT_TYPES.BLUEPRINT_LAUNCHED,
      entityType: "blueprint",
      entityId: launchedBlueprintId,
      userId: input.user_id,
      blueprintId: launchedBlueprintId,
      payload: {
        validation_run_id: run.id,
        selected_path: run.selected_path,
        generation_trigger: "blueprint_launched",
        generation_mode: "initial",
        milestones: selectedPathRow?.milestones ?? [],
      },
      idempotencyKey: `blueprint_launched_from_validation:${run.id}`,
    }).catch(() => null);

    return {
      blueprint_id: launchedBlueprintId,
      redirect_to: `/dashboard?blueprint_id=${launchedBlueprintId}`,
    };
  },
};
