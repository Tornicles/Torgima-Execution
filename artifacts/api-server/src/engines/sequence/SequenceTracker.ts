import {
  blueprintSequenceHistory,
  blueprints,
  db,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import type { BlueprintSequenceName } from "../../types/blueprintSequences.js";
import {
  ALL_SEQUENCES,
  CANONICAL_TO_SEQUENCE_NUMBER,
  TOTAL_NUMBERED_SEQUENCES,
  type BlueprintTierLabel,
  type SequenceStatusItem,
} from "../../types/sequences.js";

export type BlueprintSequenceRow = {
  id: string;
  tier: string | null;
  blueprint_tier: string | null;
  selected_blueprint_level: string | null;
  current_sequence_number: number;
  sequences_completed_numbers: number[];
  sequence_audit_log: string[];
  last_sequence_update: Date | null;
};

export function normalizeBlueprintTier(
  tier?: string | null,
  blueprintTier?: string | null,
  selectedLevel?: string | null,
): BlueprintTierLabel {
  const raw = (blueprintTier ?? selectedLevel ?? tier ?? "starter").toLowerCase();
  if (raw === "growth") return "Growth";
  if (raw === "ultimate") return "Ultimate";
  return "Starter";
}

export function tierMeetsRequirement(
  blueprintTier: BlueprintTierLabel,
  required?: BlueprintTierLabel,
): boolean {
  if (!required) return true;
  if (required === "Starter") return true;
  if (required === "Growth") return blueprintTier === "Growth" || blueprintTier === "Ultimate";
  return blueprintTier === "Ultimate";
}

export function computeSequenceLocked(
  sequenceNumber: number,
  blueprintTier: BlueprintTierLabel,
  completedNumbers: number[],
): boolean {
  const sequence = ALL_SEQUENCES[sequenceNumber];
  if (!sequence) return true;

  if (sequence.requiresTier && !tierMeetsRequirement(blueprintTier, sequence.requiresTier)) {
    return true;
  }

  if (sequence.unlocksAfter != null && !completedNumbers.includes(sequence.unlocksAfter)) {
    return true;
  }

  return false;
}

function auditLine(sequenceNumber: number, name: string): string {
  return `${new Date().toISOString()}: Sequence ${sequenceNumber} (${name}) recorded`;
}

async function loadBlueprintRow(blueprintId: string): Promise<BlueprintSequenceRow | null> {
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
  return row ?? null;
}

export type SequenceCheckpoint = {
  userAction?: string;
  stateSnapshot?: Record<string, unknown>;
  validationPassed?: boolean;
  validationErrors?: string[];
  markCompleted?: boolean;
};

export const SequenceTracker = {
  async recordCheckpoint(
    blueprintId: string,
    sequenceNumber: number,
    checkpoint: SequenceCheckpoint = {},
  ) {
    const sequence = ALL_SEQUENCES[sequenceNumber];
    if (!sequence) {
      throw new Error(`Invalid sequence number: ${sequenceNumber}`);
    }

    const now = new Date();
    const [history] = await db
      .insert(blueprintSequenceHistory)
      .values({
        blueprint_id: blueprintId,
        sequence_number: sequenceNumber,
        sequence_name: sequence.name,
        state_snapshot: checkpoint.stateSnapshot ?? {},
        validation_passed: checkpoint.validationPassed ?? false,
        validation_errors: checkpoint.validationErrors ?? [],
        user_action: checkpoint.userAction ?? null,
        completed_at: checkpoint.markCompleted !== false ? now : null,
      })
      .returning();

    const blueprint = await loadBlueprintRow(blueprintId);
    if (blueprint) {
      const completed = new Set(blueprint.sequences_completed_numbers ?? []);
      if (checkpoint.markCompleted !== false) {
        completed.add(sequenceNumber);
      }
      const audit = [...(blueprint.sequence_audit_log ?? []), auditLine(sequenceNumber, sequence.name)];

      await db
        .update(blueprints)
        .set({
          current_sequence_number: sequenceNumber,
          sequences_completed_numbers: [...completed],
          last_sequence_update: now,
          sequence_audit_log: audit,
        })
        .where(eq(blueprints.id, blueprintId));
    }

    return history;
  },

  async recordCanonicalCheckpoint(
    blueprintId: string,
    canonicalName: BlueprintSequenceName,
    checkpoint?: SequenceCheckpoint,
  ) {
    const num = CANONICAL_TO_SEQUENCE_NUMBER[canonicalName];
    if (!num) return null;
    const base = checkpoint ?? {};
    return this.recordCheckpoint(blueprintId, num, {
      ...base,
      stateSnapshot: { canonical: canonicalName, ...(base.stateSnapshot ?? {}) },
    });
  },

  async advanceSequence(blueprintId: string, reason: string) {
    const blueprint = await loadBlueprintRow(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }

    const tier = normalizeBlueprintTier(
      blueprint.tier,
      blueprint.blueprint_tier,
      blueprint.selected_blueprint_level,
    );
    const currentSeq = blueprint.current_sequence_number ?? 1;
    const nextSeq = Math.min(currentSeq + 1, TOTAL_NUMBERED_SEQUENCES);
    const locked = computeSequenceLocked(
      nextSeq,
      tier,
      blueprint.sequences_completed_numbers ?? [],
    );

    if (!locked && nextSeq !== currentSeq) {
      await this.recordCheckpoint(blueprintId, nextSeq, {
        userAction: reason,
        stateSnapshot: { advanced_from: currentSeq, advanced_reason: reason },
        validationPassed: true,
        markCompleted: false,
      });
    }

    return {
      nextSequence: nextSeq,
      locked,
      reason: locked ? "Sequence locked by tier or prerequisites" : "Advanced",
    };
  },

  isSequenceLocked(blueprint: BlueprintSequenceRow, sequenceNumber: number): boolean {
    const tier = normalizeBlueprintTier(
      blueprint.tier,
      blueprint.blueprint_tier,
      blueprint.selected_blueprint_level,
    );
    return computeSequenceLocked(
      sequenceNumber,
      tier,
      blueprint.sequences_completed_numbers ?? [],
    );
  },

  async getSequenceStatus(blueprintId: string) {
    const blueprint = await loadBlueprintRow(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }

    const tier = normalizeBlueprintTier(
      blueprint.tier,
      blueprint.blueprint_tier,
      blueprint.selected_blueprint_level,
    );
    const completed = blueprint.sequences_completed_numbers ?? [];

    const historyRows = await db
      .select()
      .from(blueprintSequenceHistory)
      .where(eq(blueprintSequenceHistory.blueprint_id, blueprintId))
      .orderBy(asc(blueprintSequenceHistory.sequence_number));

    const historyByNum = new Map(historyRows.map((h) => [h.sequence_number, h]));

    const sequences: SequenceStatusItem[] = Object.values(ALL_SEQUENCES).map((seq) => {
      const history = historyByNum.get(seq.number);
      const locked = computeSequenceLocked(seq.number, tier, completed);
      return {
        number: seq.number,
        name: seq.name,
        tier: seq.tier,
        completed: completed.includes(seq.number),
        locked,
        completedAt: history?.completed_at?.toISOString(),
        durationMs: history?.duration_ms,
        validation: {
          passed: history?.validation_passed ?? false,
          errors: history?.validation_errors ?? [],
        },
      };
    });

    return {
      blueprintId,
      tier,
      currentSequence: blueprint.current_sequence_number ?? 1,
      completedCount: completed.length,
      totalSequences: TOTAL_NUMBERED_SEQUENCES,
      sequences,
      progress: (completed.length / TOTAL_NUMBERED_SEQUENCES) * 100,
    };
  },

  async getAuditTrail(blueprintId: string) {
    const blueprint = await loadBlueprintRow(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }
    return {
      blueprintId,
      auditLog: blueprint.sequence_audit_log ?? [],
      lastUpdate: blueprint.last_sequence_update,
    };
  },

  async validateSequence(blueprintId: string, sequenceNumber: number) {
    const blueprint = await loadBlueprintRow(blueprintId);
    if (!blueprint) {
      return { valid: false, errors: ["Blueprint not found"] };
    }

    const errors: string[] = [];
    const sequence = ALL_SEQUENCES[sequenceNumber];
    if (!sequence) {
      errors.push(`Invalid sequence number: ${sequenceNumber}`);
      return { valid: false, errors };
    }

    const tier = normalizeBlueprintTier(
      blueprint.tier,
      blueprint.blueprint_tier,
      blueprint.selected_blueprint_level,
    );
    const completed = blueprint.sequences_completed_numbers ?? [];

    if (sequence.unlocksAfter != null && !completed.includes(sequence.unlocksAfter)) {
      errors.push(`Prerequisite sequence ${sequence.unlocksAfter} not completed`);
    }

    if (sequence.requiresTier && !tierMeetsRequirement(tier, sequence.requiresTier)) {
      errors.push(`Tier requirement not met: ${sequence.requiresTier}`);
    }

    return { valid: errors.length === 0, errors };
  },
};
