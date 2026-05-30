import { db, validations, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { finalizeValidationWorkspace } from "../engines/erector/ErectorValidationWorkspace.js";
import {
  normalizeSelectedPath,
  resolveDefaultSelectedPath,
  type ValidationPathType,
} from "../lib/validationPathSelection.js";
import { ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { mergeValidationTimeframeFromRow } from "../lib/validationTimeframe.js";

export type FinalizedValidationRow = typeof validations.$inferSelect;

function hasGeneratedPaths(row: typeof validations.$inferSelect): boolean {
  if (row.path_current && row.path_adjusted && row.path_alternative) return true;
  const options = row.path_options as Record<string, unknown> | null;
  return Boolean(options && (options.current || options.adjusted || options.alternative));
}

function hasContext(row: typeof validations.$inferSelect): boolean {
  return Boolean(
    row.location_context?.trim() ||
      row.current_context?.trim() ||
      row.domain?.trim() ||
      row.location_country?.trim() ||
      row.reality_context?.trim(),
  );
}

/** True when launch must be preceded by explicit finalization. */
export function requiresLaunchFinalization(row: typeof validations.$inferSelect): boolean {
  if (row.is_finalized) return false;
  if (row.validation_kind === ValidationKind.ERECTOR) return true;
  if (row.stage_final_decision != null) return true;
  const sections = row.validation_sections as unknown[] | null;
  if (Array.isArray(sections) && sections.length > 0) return true;
  // validation_version defaults to 1 in DB — treat versioned intelligence validations as finalization-gated
  if (row.validation_kind === ValidationKind.INTELLIGENCE && row.validation_version != null) return true;
  return row.validation_version != null || row.stage_final_decision != null;
}

function buildIntelligenceHandoff(
  row: typeof validations.$inferSelect,
  selectedPath: ValidationPathType,
): Record<string, unknown> {
  return {
    goal_final: row.goal_final ?? row.raw_goal ?? "",
    purpose_final: row.purpose_final ?? row.purpose ?? "",
    country: row.location_country ?? row.location_context ?? row.country ?? "",
    economic_type: row.economic_type ?? row.domain ?? "",
    business_type: row.business_type ?? "",
    timeframe: row.timeframe ?? (row.timeframe_days != null ? `${row.timeframe_days} days` : undefined),
    timeframe_days: row.timeframe_days,
    final_decision: row.verdict ?? "adjust",
    selected_path: selectedPath,
    paths: {
      current: row.path_current,
      adjusted: row.path_adjusted,
      alternative: row.path_alternative,
    },
  };
}

function assertReadyToFinalize(
  row: typeof validations.$inferSelect,
  selectedPath: ValidationPathType,
): void {
  const fieldErrors: Record<string, string[]> = {};

  const goal = (row.raw_goal ?? row.goal_final ?? "").trim();
  const purpose = (row.purpose ?? row.purpose_final ?? "").trim();
  if (!goal) fieldErrors.goal = ["Goal is required before finalization"];
  if (!purpose) fieldErrors.purpose = ["Purpose is required before finalization"];
  if (!row.timeframe?.trim() && row.timeframe_days == null) {
    fieldErrors.timeframe = ["Timeframe is required before finalization"];
  }
  if (!hasContext(row)) {
    fieldErrors.context = ["Context (location, domain, or current context) is required before finalization"];
  }
  if (!hasGeneratedPaths(row)) {
    fieldErrors.paths = ["Validation paths must be generated before finalization"];
  }
  if (!selectedPath) {
    fieldErrors.selected_path = ["Select a validation path before finalization"];
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "Validation is not ready to finalize. Complete required fields and select a path.",
      false,
      fieldErrors,
    );
  }
}

export const ValidationFinalizationService = {
  requiresLaunchFinalization,

  async finalizeValidation(
    validationId: string,
    userId: string,
    options?: { selectedPath?: ValidationPathType },
  ): Promise<FinalizedValidationRow> {
    const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
    if (!row || row.user_id !== userId) {
      throw new TorgimaError("NOT_FOUND", "Validation not found", false);
    }

    let effectiveRow = row;
    if ((!row.raw_goal?.trim() || !row.purpose?.trim() || (!row.timeframe?.trim() && row.timeframe_days == null)) && row.blueprint_id) {
      const [bp] = await db
        .select({
          goal: blueprints.goal,
          raw_goal: blueprints.raw_goal,
          purpose: blueprints.purpose,
          timeframe_days: blueprints.timeframe_days,
          domain: blueprints.domain,
          current_context: blueprints.current_context,
        })
        .from(blueprints)
        .where(eq(blueprints.id, row.blueprint_id))
        .limit(1);
      if (bp) {
        const mergedTf = mergeValidationTimeframeFromRow(row, bp);
        effectiveRow = {
          ...row,
          raw_goal: row.raw_goal ?? bp.raw_goal ?? bp.goal,
          purpose: row.purpose ?? bp.purpose,
          timeframe: mergedTf.timeframe,
          timeframe_days: mergedTf.timeframe_days,
          domain: row.domain ?? bp.domain ?? null,
          current_context: row.current_context ?? bp.current_context ?? null,
          location_context: row.location_context ?? row.location_country ?? null,
        };
      }
    } else if (!row.timeframe?.trim() && row.timeframe_days == null) {
      const mergedTf = mergeValidationTimeframeFromRow(row);
      effectiveRow = {
        ...row,
        timeframe: mergedTf.timeframe,
        timeframe_days: mergedTf.timeframe_days,
      };
    }

    if (row.is_finalized) {
      return row;
    }

    const selectedPath: ValidationPathType =
      options?.selectedPath ??
      normalizeSelectedPath(effectiveRow) ??
      resolveDefaultSelectedPath(effectiveRow.verdict);

    assertReadyToFinalize(effectiveRow, selectedPath);

    if (effectiveRow.validation_kind === ValidationKind.ERECTOR) {
      await finalizeValidationWorkspace(validationId, userId);
      const [finalized] = await db
        .select()
        .from(validations)
        .where(eq(validations.id, validationId))
        .limit(1);
      if (!finalized?.is_finalized) {
        throw new TorgimaError("INTERNAL_ERROR", "Erector validation finalization failed");
      }
      return finalized;
    }

    const handoff = buildIntelligenceHandoff(effectiveRow, selectedPath);
    const now = new Date();

    const [updated] = await db
      .update(validations)
      .set({
        is_finalized: true,
        finalized_at: now,
        selected_path: selectedPath,
        selected_path_type: selectedPath,
        selected_at: row.selected_at ?? now,
        handoff_package: handoff,
        validation_final: handoff,
        status: ValidationStatus.COMPLETE,
      })
      .where(eq(validations.id, validationId))
      .returning();

    if (!updated) {
      throw new TorgimaError("INTERNAL_ERROR", "Failed to finalize validation");
    }

    return updated;
  },
};
