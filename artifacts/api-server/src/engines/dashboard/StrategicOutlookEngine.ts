import {
  db,
  blueprints,
  signalSnapshots,
  burnoutRecords,
  blueprintHealthRecords,
  morningReports,
  strategicOutlookRecords,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { trigger } from "../../bhudhi/BhudhiCore.js";
import { getActivePatterns } from "../pattern/PatternLearningEngine.js";

export type MomentumTrajectory = "ACCELERATING" | "STABLE" | "DECELERATING" | "REVERSING";
export type OutlookConfidenceTier = "LOW" | "MEDIUM" | "HIGH";

export interface StrategicOutlook {
  executionForecast: string;
  riskFactors: Array<{ risk: string; likelihood: "LOW" | "MEDIUM" | "HIGH"; mitigation: string }>;
  opportunityFlags: string[];
  highestLeverageAction: string;
  conditionPrediction: string;
  momentumTrajectory: MomentumTrajectory;
  confidenceTier: OutlookConfidenceTier;
  generatedAt: string;
  expiresAt: string;
}

export function confidenceTierForSignalDays(signalDays: number, patternCount: number): OutlookConfidenceTier {
  if (signalDays >= 21 && patternCount >= 5) return "HIGH";
  if (signalDays >= 7) return "MEDIUM";
  return "LOW";
}

export function momentumTrajectoryFromSignals(
  signals: Array<{ momentum: number; trend?: string | null }>,
): MomentumTrajectory {
  if (signals.length < 2) return "STABLE";
  const latest = signals[0]?.momentum ?? 0;
  const oldest = signals[signals.length - 1]?.momentum ?? latest;
  const drift = latest - oldest;
  if (drift >= 15) return "ACCELERATING";
  if (drift <= -15) return "DECELERATING";
  if (signals[0]?.trend === "declining" && drift < 0) return "REVERSING";
  return "STABLE";
}

export function buildDeterministicStrategicOutlook(input: {
  signalDays: number;
  momentumTrajectory: MomentumTrajectory;
  currentCondition: string;
  burnoutRisk?: string | null;
  opportunity?: string;
}): StrategicOutlook {
  const confidenceTier = confidenceTierForSignalDays(input.signalDays, input.signalDays >= 21 ? 5 : 1);
  const uncertainty =
    confidenceTier === "LOW" ? " Current patterns suggest this with limited signal history." : "";
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    executionForecast: `Execution trajectory is ${input.momentumTrajectory.toLowerCase()} from recent signal movement.${uncertainty}`,
    riskFactors: [
      {
        risk: input.burnoutRisk === "HIGH" ? "Recovery pressure may reduce signal quality" : "Signal consistency may drift",
        likelihood: input.burnoutRisk === "HIGH" ? "HIGH" : "MEDIUM",
        mitigation: "Keep the next order narrow and evidence-based.",
      },
    ],
    opportunityFlags: [input.opportunity ?? "Execution window open for one proof-led cycle"],
    highestLeverageAction: "Complete the active order with clear proof and one measurable outcome.",
    conditionPrediction: `Momentum signals indicate ${input.currentCondition} remains the likely 7-day condition unless completion signal changes.`,
    momentumTrajectory: input.momentumTrajectory,
    confidenceTier,
    generatedAt: new Date().toISOString(),
    expiresAt,
  };
}

export async function generateStrategicOutlook(userId: string): Promise<StrategicOutlook> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);

  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const signals = bp
    ? await db
        .select()
        .from(signalSnapshots)
        .where(and(eq(signalSnapshots.user_id, userId), eq(signalSnapshots.blueprint_id, bp.id), gte(signalSnapshots.created_at, since)))
        .orderBy(desc(signalSnapshots.created_at))
    : [];
  const [burnout] = await db
    .select()
    .from(burnoutRecords)
    .where(eq(burnoutRecords.user_id, userId))
    .orderBy(desc(burnoutRecords.created_at))
    .limit(1)
    .catch(() => []);
  const patterns = bp ? await getActivePatterns(userId, bp.id).catch(() => []) : [];
  const [health] = bp
    ? await db
        .select()
        .from(blueprintHealthRecords)
        .where(eq(blueprintHealthRecords.blueprint_id, bp.id))
        .orderBy(desc(blueprintHealthRecords.created_at))
        .limit(1)
        .catch(() => [])
    : [];
  const [morning] = await db
    .select({ eis_section: morningReports.eis_section })
    .from(morningReports)
    .where(eq(morningReports.user_id, userId))
    .orderBy(desc(morningReports.report_date))
    .limit(1)
    .catch(() => []);

  const trajectory = momentumTrajectoryFromSignals(signals);
  let outlook = buildDeterministicStrategicOutlook({
    signalDays: signals.length,
    momentumTrajectory: trajectory,
    currentCondition: bp?.current_condition ?? "stability",
    burnoutRisk: burnout?.risk_level,
    opportunity: ((morning?.eis_section as { opportunityWindows?: Array<{ description?: string; trend?: string }> } | null)
      ?.opportunityWindows?.[0]?.description),
  });

  try {
    const result = await trigger({
      sourceEngine: "StrategicOutlookEngine",
      triggerType: "DIRECTION_ANALYSIS",
      userId,
      blueprintId: bp?.id,
      stateVersion: bp?.state_version ?? 0,
      idempotencyKey: `strategic_outlook:${userId}:${new Date().toISOString().slice(0, 10)}`,
      facts: {
        signalTrajectories: signals,
        burnoutRecord: burnout ?? null,
        activePatterns: patterns,
        eisBriefing: morning?.eis_section ?? null,
        blueprintHealth: health ?? null,
        currentCondition: bp?.current_condition ?? "stability",
        stateVersion: bp?.state_version ?? 0,
      },
    });
    if (result.ok && result.output?.data) {
      const d = result.output.data as Partial<StrategicOutlook>;
      outlook = {
        ...outlook,
        executionForecast: d.executionForecast ?? outlook.executionForecast,
        riskFactors: d.riskFactors ?? outlook.riskFactors,
        opportunityFlags: d.opportunityFlags ?? outlook.opportunityFlags,
        highestLeverageAction: d.highestLeverageAction ?? outlook.highestLeverageAction,
        conditionPrediction: d.conditionPrediction ?? outlook.conditionPrediction,
        momentumTrajectory: d.momentumTrajectory ?? outlook.momentumTrajectory,
        confidenceTier: d.confidenceTier ?? outlook.confidenceTier,
      };
    }
  } catch {
    // Deterministic outlook remains valid.
  }

  await db.insert(strategicOutlookRecords).values({
    user_id: userId,
    execution_forecast: outlook.executionForecast,
    risk_factors: outlook.riskFactors,
    opportunity_flags: outlook.opportunityFlags,
    highest_leverage_action: outlook.highestLeverageAction,
    condition_prediction: outlook.conditionPrediction,
    momentum_trajectory: outlook.momentumTrajectory,
    confidence_tier: outlook.confidenceTier,
    expires_at: new Date(outlook.expiresAt),
  }).catch(() => null);

  return outlook;
}
