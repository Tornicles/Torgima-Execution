import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent } from "../../services/EventService.js";
import { EventTypes } from "../../types/eventContracts.js";
import { applyArchetypeToTaskLimits } from "./ErectorExecutionBridge.js";

export { applyArchetypeToTaskLimits };

const DIFFICULTY_LEVELS = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;

/** High-pressure economies shorten the rolling window; slow economies widen it (Prompt 5). */
export function archetypeSignalWindowDays(archetypeTimeframeMult?: number | null): number {
  const timeMult = Math.max(0.5, archetypeTimeframeMult ?? 1.0);
  return Math.max(5, Math.min(14, Math.round(7 / timeMult)));
}

export function shiftDifficultyCap(cap: string, shift: number): string {
  const idx = DIFFICULTY_LEVELS.indexOf(cap as (typeof DIFFICULTY_LEVELS)[number]);
  const baseIdx = idx >= 0 ? idx : 2;
  return DIFFICULTY_LEVELS[Math.max(0, Math.min(4, baseIdx + shift))] ?? cap;
}

export function archetypeDifficultyShift(diffAdj: number | null | undefined): number {
  const adj = diffAdj ?? 0;
  if (adj > 0.3) return 1;
  if (adj < -0.3) return -1;
  return 0;
}

export type ExecutionLoopKind = "primary" | "daily" | "background";

export interface BlueprintArchetypeContext {
  primaryArchetypeId: string | null;
  archetypeExecutionMult: number | null;
  archetypeTimeframeMult: number | null;
  archetypeDifficultyAdj: number | null;
  industryState: string | null;
  realityScore: number | null;
}

export async function loadBlueprintArchetypeContext(blueprintId: string): Promise<BlueprintArchetypeContext | null> {
  const [row] = await db
    .select({
      primary_archetype_id: blueprints.primary_archetype_id,
      archetype_execution_mult: blueprints.archetype_execution_mult,
      archetype_timeframe_mult: blueprints.archetype_timeframe_mult,
      archetype_difficulty_adj: blueprints.archetype_difficulty_adj,
      industry_state: blueprints.industry_state,
      reality_score: blueprints.reality_score,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  if (!row) return null;
  return {
    primaryArchetypeId: row.primary_archetype_id,
    archetypeExecutionMult: row.archetype_execution_mult,
    archetypeTimeframeMult: row.archetype_timeframe_mult,
    archetypeDifficultyAdj: row.archetype_difficulty_adj,
    industryState: row.industry_state,
    realityScore: row.reality_score,
  };
}

export async function emitArchetypeContextMissingIfNeeded(params: {
  blueprintId: string;
  userId: string;
  primaryArchetypeId: string | null | undefined;
  loop: ExecutionLoopKind;
}): Promise<void> {
  if (params.primaryArchetypeId) return;
  const dayKey = new Date().toISOString().slice(0, 10);
  await writeEvent({
    eventType: EventTypes.ARCHETYPE_CONTEXT_MISSING,
    entityType: "blueprint",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      reason: "archetype_fields_null",
      loop: params.loop,
    },
    idempotencyKey: `archetype_context_missing:${params.blueprintId}:${params.loop}:${dayKey}`,
  }).catch(() => null);
  logger.warn(
    { blueprintId: params.blueprintId, loop: params.loop },
    "[ArchetypeExecution] archetype_context_missing emitted",
  );
}

/** Primary loop — enforcement package task limits (ConditionAssignment path). */
export function applyArchetypeTaskLimitsWithLog(params: {
  blueprintId: string;
  baseMin: number;
  baseMax: number;
  archetypeExecutionMult?: number | null;
}): { min: number; max: number } {
  const archetypeMult = params.archetypeExecutionMult ?? 1.0;
  const adjusted = applyArchetypeToTaskLimits(params.baseMin, params.baseMax, archetypeMult);
  logger.info(
    {
      blueprint_id: params.blueprintId,
      archetypeMult,
      baseMin: params.baseMin,
      baseMax: params.baseMax,
      adjustedMin: adjusted.min,
      adjustedMax: adjusted.max,
    },
    "[ConditionAssignment] Archetype mult applied",
  );
  return adjusted;
}
