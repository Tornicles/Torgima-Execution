import { db, blueprints, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintStatus, ValidationKind } from "@workspace/state-machine";
import { logger } from "./logger.js";
import {
  normalizeSelectedPath,
  resolveDefaultSelectedPath,
  type ValidationPathType,
} from "./validationPathSelection.js";
import { ensureTierPreviewsPresent } from "./ensureTierPreviews.js";

export type TransitionToPathSelectionParams = {
  blueprintId: string;
  userId: string;
  validationId: string;
  verdict?: string | null;
  selectedPath?: ValidationPathType;
  realityScore?: number | null;
  intelligencePayload?: Record<string, unknown> | null;
  pathOptions?: { current?: unknown; adjusted?: unknown; alternative?: unknown } | null;
  recommendedTier?: string | null;
  validationKind?: string | null;
};

/**
 * Move blueprint into path_selection after validation completes or user picks a path.
 * Idempotent — safe to call multiple times.
 */
export async function transitionBlueprintToPathSelection(
  params: TransitionToPathSelectionParams,
): Promise<void> {
  const selectedPath =
    params.selectedPath ?? resolveDefaultSelectedPath(params.verdict ?? null);

  const pathOptions =
    params.pathOptions ??
    (params.intelligencePayload?.paths as TransitionToPathSelectionParams["pathOptions"]) ??
    null;

  const tierRaw = params.recommendedTier;
  const tier =
    tierRaw === "starter" || tierRaw === "growth" || tierRaw === "ultimate" ? tierRaw : undefined;

  const blueprintPatch: Partial<typeof blueprints.$inferInsert> = {
    status: BlueprintStatus.PATH_SELECTION,
    validation_id: params.validationId,
    validation_verdict: params.verdict ?? null,
    reality_score: params.realityScore ?? null,
    validation_report: params.intelligencePayload ?? null,
    path_options: pathOptions ?? undefined,
    selected_path: selectedPath,
    ...(tier ? { tier, blueprint_tier: tier, selected_blueprint_level: tier } : {}),
    updated_at: new Date(),
  };

  if (params.validationKind === ValidationKind.ERECTOR) {
    blueprintPatch.erector_validation_id = params.validationId;
  }

  if (params.intelligencePayload) {
    blueprintPatch.intel_metadata = {
      validationComplete: true,
      intelligence: params.intelligencePayload,
      transitionedAt: new Date().toISOString(),
    };
  }

  await db
    .update(blueprints)
    .set(blueprintPatch)
    .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)));

  const [val] = await db
    .select({
      selected_path: validations.selected_path,
      selected_path_type: validations.selected_path_type,
    })
    .from(validations)
    .where(eq(validations.id, params.validationId))
    .limit(1);

  if (val && !val.selected_path && !val.selected_path_type) {
    await db
      .update(validations)
      .set({
        status: "complete",
        selected_path: selectedPath,
        selected_path_type: selectedPath,
        selected_at: new Date(),
      })
      .where(eq(validations.id, params.validationId));
  }

  logger.info(
    { blueprintId: params.blueprintId, validationId: params.validationId, selectedPath },
    "[Validation] Blueprint moved to path_selection",
  );

  if (params.verdict !== "pivot") {
    await ensureTierPreviewsPresent(params.validationId, params.userId);
  }
}

export async function ensureBlueprintReadyForLaunch(
  blueprintId: string,
  userId: string,
  validationRow: typeof validations.$inferSelect,
): Promise<void> {
  const [bp] = await db
    .select({
      id: blueprints.id,
      status: blueprints.status,
      validation_id: blueprints.validation_id,
    })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp) {
    throw new Error(`[LAUNCH] Blueprint not found: ${blueprintId}`);
  }

  logger.info({ blueprintId, status: bp.status }, "[LAUNCH] Blueprint current status");

  const launchableStatuses = new Set<string>([
    BlueprintStatus.PATH_SELECTION,
    BlueprintStatus.AWAITING_SELECTION,
    BlueprintStatus.DRAFT,
    BlueprintStatus.VALIDATING,
  ]);

  if (!launchableStatuses.has(bp.status)) {
    throw new Error(`[LAUNCH] Blueprint status ${bp.status} cannot be launched`);
  }

  if (bp.status === BlueprintStatus.PATH_SELECTION) {
    return;
  }

  const stage = validationRow.erector_validation_stage ?? validationRow.validation_stage ?? validationRow.status;
  const validationComplete =
    stage === "complete" ||
    validationRow.status === "complete" ||
    Boolean(validationRow.verdict);

  if (!validationComplete && !bp.validation_id && !validationRow.id) {
    throw new Error("[LAUNCH] Blueprint has no validation. Cannot launch without completed validation.");
  }

  const selectedPath =
    normalizeSelectedPath(validationRow) ?? resolveDefaultSelectedPath(validationRow.verdict);

  await transitionBlueprintToPathSelection({
    blueprintId,
    userId,
    validationId: validationRow.id,
    verdict: validationRow.verdict,
    selectedPath,
    realityScore: validationRow.reality_score,
    intelligencePayload: (validationRow.intelligence_payload as Record<string, unknown> | null) ?? null,
    pathOptions: {
      current: validationRow.path_current,
      adjusted: validationRow.path_adjusted,
      alternative: validationRow.path_alternative,
    },
    recommendedTier:
      validationRow.recommended_blueprint_level ?? validationRow.selected_blueprint_tier ?? "starter",
    validationKind: validationRow.validation_kind,
  });

  logger.info({ blueprintId }, "[LAUNCH] Force-transitioned blueprint to path_selection");
}
