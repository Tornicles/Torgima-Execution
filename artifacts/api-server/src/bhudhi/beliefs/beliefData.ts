import {
  db,
  bhudhiBeliefRecords,
  bhudhiBeliefEvidence,
  bhudhiBeliefHistory,
  bhudhiBeliefTruth,
  bhudhiBeliefConflicts,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { BeliefOutput, BeliefRecord, ContradictionResult, EvolutionEvent } from "./contracts/types.js";
import type { TruthAssessment } from "./contracts/types.js";

export async function persistBeliefSession(
  output: BeliefOutput,
  input: { blueprintId: string; userId?: string; trigger?: string },
): Promise<void> {
  const all = [...output.facts, ...output.beliefs, ...output.assumptions, ...output.hypotheses];

  for (const r of all) {
    await db.insert(bhudhiBeliefRecords).values({
      id: r.beliefId,
      blueprint_id: input.blueprintId,
      user_id: input.userId ?? null,
      trigger: input.trigger ?? null,
      belief_type: r.type,
      statement: r.statement,
      origin: r.origin,
      state: r.state,
      confidence: r.confidence,
      evidence: r.evidence,
      memory_class: r.memoryClass ?? "ACTIVE",
      truth_score: r.truthScore ?? null,
    });

    for (const ev of r.evidence) {
      await db.insert(bhudhiBeliefEvidence).values({
        belief_id: r.beliefId,
        source: ev.source,
        reliability: ev.reliability,
        recency: ev.recency,
        agreement: ev.agreement,
        repeatability: ev.repeatability,
        evidence_score: ev.evidenceScore,
        strength: ev.strength,
        payload: {},
      });
    }
  }

  for (const c of output.contradictions) {
    await db.insert(bhudhiBeliefConflicts).values({
      blueprint_id: input.blueprintId,
      belief_id_a: c.beliefIdA ?? null,
      belief_id_b: c.beliefIdB ?? null,
      conflict_type: c.conflictType,
      description: c.description,
      action: c.action,
    });
  }
}

export async function persistTruth(beliefId: string, truth: TruthAssessment): Promise<void> {
  await db.insert(bhudhiBeliefTruth).values({
    belief_id: beliefId,
    truth_score: truth.truthScore,
    stability: truth.stability,
    certainty: truth.certainty,
    category: truth.category,
    conflicts: truth.conflicts,
    expires_at: truth.expiresAt ?? null,
  });
}

export async function persistEvolution(event: EvolutionEvent): Promise<void> {
  await db.insert(bhudhiBeliefHistory).values({
    belief_id: event.beliefId,
    change_type: event.changeType,
    previous_state: event.previousState ?? null,
    new_state: event.newState,
    reason: event.reason,
    confidence_before: event.confidenceBefore ?? null,
    confidence_after: event.confidenceAfter ?? null,
    quality_score: event.qualityScore ?? null,
  });
}

export async function updateBeliefState(
  beliefId: string,
  state: string,
  confidence?: number,
): Promise<void> {
  await db
    .update(bhudhiBeliefRecords)
    .set({
      state,
      ...(confidence !== undefined ? { confidence } : {}),
      updated_at: new Date(),
    })
    .where(eq(bhudhiBeliefRecords.id, beliefId));
}

export async function listBeliefHistory(blueprintId: string, limit = 30) {
  const rows = await db
    .select()
    .from(bhudhiBeliefRecords)
    .where(eq(bhudhiBeliefRecords.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiBeliefRecords.created_at))
    .limit(limit);

  return rows.map((r) => ({
    beliefId: r.id,
    type: r.belief_type,
    statement: r.statement,
    state: r.state,
    confidence: r.confidence,
    origin: r.origin,
    createdAt: r.created_at,
  }));
}

export async function getBelief(beliefId: string) {
  const rows = await db
    .select()
    .from(bhudhiBeliefRecords)
    .where(eq(bhudhiBeliefRecords.id, beliefId))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveConflict(conflictId: string): Promise<boolean> {
  const result = await db
    .update(bhudhiBeliefConflicts)
    .set({ resolved: true })
    .where(eq(bhudhiBeliefConflicts.id, conflictId))
    .returning({ id: bhudhiBeliefConflicts.id });
  return result.length > 0;
}

export function rowToBeliefRecord(row: typeof bhudhiBeliefRecords.$inferSelect): BeliefRecord {
  return {
    beliefId: row.id,
    type: row.belief_type as BeliefRecord["type"],
    statement: row.statement,
    origin: row.origin,
    confidence: row.confidence,
    evidence: (row.evidence as BeliefRecord["evidence"]) ?? [],
    state: row.state as BeliefRecord["state"],
    memoryClass: row.memory_class as BeliefRecord["memoryClass"],
    truthScore: row.truth_score ?? undefined,
  };
}
