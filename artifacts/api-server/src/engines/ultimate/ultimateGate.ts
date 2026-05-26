import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import {
  SequenceTracker,
  normalizeBlueprintTier,
  type BlueprintSequenceRow,
} from "../sequence/SequenceTracker.js";

export const ULTIMATE_SEQUENCE_NUMBER = 25;

async function loadBlueprintForGate(blueprintId: string): Promise<BlueprintSequenceRow> {
  const [row] = await db
    .select({
      id: blueprints.id,
      tier: blueprints.tier,
      blueprint_tier: blueprints.blueprint_tier,
      selected_blueprint_level: blueprints.selected_blueprint_level,
      current_sequence_number: blueprints.current_sequence_number,
      sequences_completed_numbers: blueprints.sequences_completed_numbers,
      sequence_audit_log: blueprints.sequence_audit_log,
      last_sequence_update: blueprints.last_sequence_update,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!row) {
    throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
  }
  return row;
}

export async function requireUltimateAccess(blueprintId: string): Promise<BlueprintSequenceRow> {
  const row = await loadBlueprintForGate(blueprintId);
  const tier = normalizeBlueprintTier(row.tier, row.blueprint_tier, row.selected_blueprint_level);

  if (tier !== "Ultimate") {
    throw new TorgimaError(
      "FEATURE_DISABLED",
      "Ultimate features require Ultimate tier blueprint",
      false,
    );
  }

  if (SequenceTracker.isSequenceLocked(row, ULTIMATE_SEQUENCE_NUMBER)) {
    throw new TorgimaError(
      "FEATURE_DISABLED",
      "Ultimate features locked until Sequence 25 prerequisites are complete",
      false,
    );
  }

  return row;
}

export function isUltimateUnlocked(row: BlueprintSequenceRow): boolean {
  const tier = normalizeBlueprintTier(row.tier, row.blueprint_tier, row.selected_blueprint_level);
  if (tier !== "Ultimate") return false;
  return !SequenceTracker.isSequenceLocked(row, ULTIMATE_SEQUENCE_NUMBER);
}
