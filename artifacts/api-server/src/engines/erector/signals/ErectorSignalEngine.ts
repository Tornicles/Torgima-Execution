import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorArchetypeClassifications,
  erectorCapabilityProfiles,
  erectorEvidenceLedger,
  erectorPhaseGates,
  erectorSignals,
  erectorUserRealityProfiles,
  erectorValidationRuns,
  falseProgressFlags,
  feedback,
  orders,
} from "@workspace/db";
import { calculateCapabilitySignal } from "./signal-calculators/capabilitySignal.js";
import { calculateCompletionSignal } from "./signal-calculators/completionSignal.js";
import { calculateConsistencySignal } from "./signal-calculators/consistencySignal.js";
import { calculateContradictionSignal } from "./signal-calculators/contradictionSignal.js";
import { calculateDemandSignal } from "./signal-calculators/demandSignal.js";
import { calculateEconomicSignal } from "./signal-calculators/economicSignal.js";
import { calculateFalseProgressSignal } from "./signal-calculators/falseProgressSignal.js";
import { calculateFeasibilitySignal } from "./signal-calculators/feasibilitySignal.js";
import { calculateMarketSignal } from "./signal-calculators/marketSignal.js";
import { calculateOutcomeMovementSignal } from "./signal-calculators/outcomeMovementSignal.js";
import { calculatePhaseReadinessSignal } from "./signal-calculators/phaseReadinessSignal.js";
import { calculateQualitySignal } from "./signal-calculators/qualitySignal.js";
import { calculateRetentionSignal } from "./signal-calculators/retentionSignal.js";
import type { ErectorSignalType, SignalCalculationInput, SignalResult } from "./types.js";

const DEMAND_EVIDENCE_CLASSES = ["CUSTOMER_SIGNAL", "PAYMENT_PROOF", "EXTERNAL_CONFIRMATION"];
const MOVEMENT_EVIDENCE_CLASSES = ["ANALYTICS_MOVEMENT", "PAYMENT_PROOF"];
const RETENTION_KEYWORDS = ["renewal", "retention", "repeat", "engagement", "subscription"];

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function evidenceDerivedDemandScore(
  records: Array<{ evidence_class: string; evidence_strength: string; id: string }>,
): { score: number; ids: string[] } {
  const demand = records.filter((r) => DEMAND_EVIDENCE_CLASSES.includes(r.evidence_class));
  const strengthWeight: Record<string, number> = {
    HIGH: 90,
    "MEDIUM-HIGH": 75,
    MEDIUM: 55,
    "LOW-MEDIUM": 35,
    LOW: 20,
    NONE: 0,
  };
  if (demand.length === 0) return { score: 0, ids: [] };
  const score =
    demand.reduce((sum, row) => sum + (strengthWeight[row.evidence_strength] ?? 20), 0) /
    demand.length;
  return { score, ids: demand.map((r) => r.id) };
}

export async function calculateErectorSignals(
  input: SignalCalculationInput,
): Promise<SignalResult[]> {
  const windowDays = input.windowDays ?? 7;
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [blueprint] = await db
    .select({ erector_archetype: blueprints.erector_archetype })
    .from(blueprints)
    .where(eq(blueprints.id, input.blueprintId))
    .limit(1);

  const archetype = input.archetype ?? blueprint?.erector_archetype ?? null;

  const feedbackRows = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, input.userId),
        eq(feedback.blueprint_id, input.blueprintId),
        gte(feedback.created_at, windowStart),
      ),
    );

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.blueprint_id, input.blueprintId), gte(orders.created_at, windowStart)),
    );

  const evidenceRows = await db
    .select()
    .from(erectorEvidenceLedger)
    .where(
      and(
        eq(erectorEvidenceLedger.user_id, input.userId),
        eq(erectorEvidenceLedger.blueprint_id, input.blueprintId),
      ),
    );

  let validationRun = null as typeof erectorValidationRuns.$inferSelect | null;
  if (input.validationRunId) {
    const [row] = await db
      .select()
      .from(erectorValidationRuns)
      .where(eq(erectorValidationRuns.id, input.validationRunId))
      .limit(1);
    validationRun = row ?? null;
  } else {
    const [row] = await db
      .select()
      .from(erectorValidationRuns)
      .where(
        and(
          eq(erectorValidationRuns.user_id, input.userId),
          eq(erectorValidationRuns.blueprint_id, input.blueprintId),
        ),
      )
      .orderBy(desc(erectorValidationRuns.created_at))
      .limit(1);
    validationRun = row ?? null;
  }

  const capabilityProfiles = await db
    .select({ capability_signal: erectorCapabilityProfiles.capability_signal })
    .from(erectorCapabilityProfiles)
    .where(
      and(
        eq(erectorCapabilityProfiles.user_id, input.userId),
        eq(erectorCapabilityProfiles.blueprint_id, input.blueprintId),
      ),
    );

  const [latestPhaseGate] = await db
    .select()
    .from(erectorPhaseGates)
    .where(eq(erectorPhaseGates.blueprint_id, input.blueprintId))
    .orderBy(desc(erectorPhaseGates.evaluated_at))
    .limit(1);

  const openFalseProgress = await db
    .select({ severity: falseProgressFlags.severity })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, input.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  let sustainabilityScore = 0.6;
  if (validationRun?.reality_profile_id) {
    const [classification] = await db
      .select({ unit_economics: erectorArchetypeClassifications.unit_economics })
      .from(erectorArchetypeClassifications)
      .where(eq(erectorArchetypeClassifications.validation_run_id, validationRun.id))
      .orderBy(desc(erectorArchetypeClassifications.created_at))
      .limit(1);
    const unit = classification?.unit_economics as { sustainability_score?: number } | null;
    if (typeof unit?.sustainability_score === "number") {
      sustainabilityScore = unit.sustainability_score;
    }
  }

  let statedHours = 20;
  if (validationRun?.reality_profile_id) {
    const [profile] = await db
      .select({ hours_per_week: erectorUserRealityProfiles.hours_per_week })
      .from(erectorUserRealityProfiles)
      .where(eq(erectorUserRealityProfiles.id, validationRun.reality_profile_id))
      .limit(1);
    if (profile?.hours_per_week) statedHours = profile.hours_per_week;
  }

  const activeDaySet = new Set<string>();
  for (const row of feedbackRows) {
    if (row.completion_status !== "skipped") {
      activeDaySet.add(row.created_at.toISOString().slice(0, 10));
    }
  }

  const skipCount = feedbackRows.filter((r) => r.completion_status === "skipped").length;
  const avgConfidence =
    feedbackRows.length > 0
      ? feedbackRows.reduce((sum, r) => sum + (r.confidence_weight ?? 1), 0) / feedbackRows.length
      : 1;

  const completedOrders = orderRows.filter((o) => o.status === "completed").length;
  const highMovement = evidenceRows.filter(
    (e) =>
      MOVEMENT_EVIDENCE_CLASSES.includes(e.evidence_class) &&
      (e.evidence_strength === "HIGH" || e.evidence_strength === "MEDIUM-HIGH"),
  );

  const contradicted = evidenceRows.filter((e) => e.contradiction_status === "confirmed");
  const demandDerived = evidenceDerivedDemandScore(evidenceRows);

  const marketEvidence = evidenceRows.filter((e) =>
    ["ANALYTICS_MOVEMENT", "EXTERNAL_CONFIRMATION", "CUSTOMER_SIGNAL"].includes(e.evidence_class),
  );
  const newestMarket = marketEvidence
    .map((e) => e.submitted_at)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const weeksSinceMarket = newestMarket ? daysBetween(new Date(), newestMarket) / 7 : 8;

  const retentionEvidence = evidenceRows.filter((e) => {
    const blob = `${e.content_summary ?? ""} ${JSON.stringify(e.content_json)}`.toLowerCase();
    return RETENTION_KEYWORDS.some((k) => blob.includes(k)) || e.evidence_class === "PAYMENT_PROOF";
  });

  const revenueEvidence = evidenceRows.filter(
    (e) => e.evidence_class === "PAYMENT_PROOF" || e.source_type === "payment_signal",
  );
  const costEvidence = evidenceRows.filter((e) => {
    const blob = JSON.stringify(e.content_json).toLowerCase();
    return blob.includes("cost") || blob.includes("expense");
  });

  const actualHours = feedbackRows.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0) / 60;

  const results: SignalResult[] = [
    calculateQualitySignal({
      feedbackScores: feedbackRows.map((r) => r.score ?? 0),
      skipCount,
      totalCount: feedbackRows.length,
      avgConfidenceWeight: avgConfidence,
    }),
    calculateConsistencySignal({ activeDays: activeDaySet.size, windowDays }),
    calculateCompletionSignal({
      completedCount: completedOrders,
      assignedCount: orderRows.length,
    }),
    calculateOutcomeMovementSignal({
      highEvidenceCount: highMovement.length,
      expectedEvidenceCount: 3,
      evidenceIds: highMovement.map((e) => e.id),
    }),
    calculateCapabilitySignal({
      capabilitySignals: capabilityProfiles.map((p) => p.capability_signal),
    }),
    calculateDemandSignal({
      validationDemandScore: validationRun?.demand_proof_score ?? null,
      evidenceDerivedScore: demandDerived.score,
      evidenceIds: demandDerived.ids,
    }),
    calculateMarketSignal({
      marketScore: validationRun?.market_viability_score ?? null,
      weeksSinceNewEvidence: weeksSinceMarket,
      evidenceIds: marketEvidence.map((e) => e.id),
    }),
    calculateFeasibilitySignal({
      feasibilityScore: validationRun?.feasibility_score ?? null,
      statedHoursPerWeek: statedHours,
      actualHoursPerWeek: actualHours,
    }),
    calculateContradictionSignal({
      contradictedCount: contradicted.length,
      totalEvidenceCount: evidenceRows.length,
      evidenceIds: contradicted.map((e) => e.id),
    }),
    calculateRetentionSignal({
      archetype,
      retentionEvidenceCount: retentionEvidence.length,
      expectedRetentionCount: 2,
      evidenceIds: retentionEvidence.map((e) => e.id),
    }),
    calculateEconomicSignal({
      sustainabilityScore,
      revenueEvidenceCount: revenueEvidence.length,
      costEvidenceCount: costEvidence.length,
      evidenceIds: [...revenueEvidence, ...costEvidence].map((e) => e.id),
    }),
    calculateFalseProgressSignal({
      openFlags: openFalseProgress,
      expectedProgressPoints: 10,
    }),
    calculatePhaseReadinessSignal({
      readinessScore: latestPhaseGate?.readiness_score ?? null,
      phaseGateId: latestPhaseGate?.id ?? null,
    }),
  ];

  return results;
}

export async function persistErectorSignals(
  input: SignalCalculationInput,
  results: SignalResult[],
): Promise<void> {
  const types = results.map((r) => r.signal_type);
  if (types.length > 0) {
    await db
      .update(erectorSignals)
      .set({ status: "superseded" })
      .where(
        and(
          eq(erectorSignals.user_id, input.userId),
          eq(erectorSignals.blueprint_id, input.blueprintId),
          inArray(erectorSignals.signal_type, types),
          eq(erectorSignals.status, "current"),
        ),
      );
  }

  if (results.length === 0) return;

  await db.insert(erectorSignals).values(
    results.map((result) => ({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      validation_run_id: input.validationRunId ?? null,
      signal_type: result.signal_type,
      value: result.value,
      confidence: result.confidence,
      source_evidence_ids: result.source_evidence_ids,
      source_execution_data: result.source_execution_data,
      calculation_method: result.calculation_method,
      status: "current",
    })),
  );
}

export async function runErectorSignalEngine(
  input: SignalCalculationInput,
): Promise<SignalResult[]> {
  const results = await calculateErectorSignals(input);
  await persistErectorSignals(input, results);
  return results;
}

export function getSignalResult(
  results: SignalResult[],
  signalType: ErectorSignalType,
): SignalResult | undefined {
  return results.find((r) => r.signal_type === signalType);
}
