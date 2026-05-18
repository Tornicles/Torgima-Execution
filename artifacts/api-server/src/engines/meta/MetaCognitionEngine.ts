import { db, metaCognitionProfiles, predictionLogs } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

type DomainReliability = { domain: string; reliabilityScore: number };

async function ensureProfile(agentName: string): Promise<typeof metaCognitionProfiles.$inferSelect> {
  const [existing] = await db
    .select()
    .from(metaCognitionProfiles)
    .where(eq(metaCognitionProfiles.agent_name, agentName))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(metaCognitionProfiles)
    .values({ agent_name: agentName })
    .returning();
  return created!;
}

function tierFromProfile(
  profile: typeof metaCognitionProfiles.$inferSelect,
  domain: string,
): "HIGH" | "MEDIUM" | "LOW" {
  const rel = (profile.domain_reliability as DomainReliability[]).find(d => d.domain === domain);
  const domainScore = rel?.reliabilityScore ?? profile.prediction_accuracy;
  const inWeak = (profile.weak_domains ?? []).includes(domain);

  if (domainScore >= 0.75 && profile.prediction_accuracy >= 0.7 && profile.hallucination_risk < 0.15 && !inWeak) {
    return "HIGH";
  }
  if (domainScore >= 0.5 && profile.prediction_accuracy >= 0.5 && profile.hallucination_risk < 0.35) {
    return "MEDIUM";
  }
  return "LOW";
}

export async function getAgentConfidenceTier(
  agentName: string,
  domain: string,
  _taskType: string,
): Promise<"HIGH" | "MEDIUM" | "LOW"> {
  const profile = await ensureProfile(agentName);
  return tierFromProfile(profile, domain);
}

export async function recordPrediction(params: {
  agentName: string;
  predictionType: string;
  prediction: Record<string, unknown>;
  confidenceLevel: number;
  userId: string;
  blueprintId?: string;
}): Promise<string> {
  const tier =
    params.confidenceLevel >= 0.75 ? "HIGH"
    : params.confidenceLevel >= 0.5 ? "MEDIUM"
    : "LOW";

  const [row] = await db
    .insert(predictionLogs)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      agent_name: params.agentName,
      prediction_type: params.predictionType,
      prediction: params.prediction,
      confidence_level: params.confidenceLevel,
      confidence_tier: tier,
    })
    .returning({ id: predictionLogs.id });

  const profile = await ensureProfile(params.agentName);
  await db
    .update(metaCognitionProfiles)
    .set({ total_predictions: profile.total_predictions + 1 })
    .where(eq(metaCognitionProfiles.agent_name, params.agentName));

  return row?.id ?? "";
}

export async function recordOutcome(
  predictionId: string,
  actualOutcome: Record<string, unknown>,
): Promise<void> {
  const [pred] = await db
    .select()
    .from(predictionLogs)
    .where(eq(predictionLogs.id, predictionId))
    .limit(1);

  if (!pred) return;

  const predicted = JSON.stringify(pred.predicted_outcome ?? pred.prediction);
  const actual = JSON.stringify(actualOutcome);
  const accurate = predicted === actual || (actual.length > 0 && predicted.includes(actual.slice(0, 40)));

  const accuracyScore = accurate ? 1 : 0;

  await db
    .update(predictionLogs)
    .set({
      actual_outcome: actualOutcome,
      accuracy_score: accuracyScore,
      verification_date: new Date(),
    })
    .where(eq(predictionLogs.id, predictionId));

  const profile = await ensureProfile(pred.agent_name);
  const correct = profile.correct_predictions + (accurate ? 1 : 0);
  const total = Math.max(profile.total_predictions, 1);
  const predictionAccuracy = correct / total;

  await db
    .update(metaCognitionProfiles)
    .set({
      correct_predictions: correct,
      prediction_accuracy: predictionAccuracy,
      last_calibration_update: new Date(),
      calibration_version: profile.calibration_version + 1,
    })
    .where(eq(metaCognitionProfiles.agent_name, pred.agent_name));
}

export async function generateUncertaintyDisclosure(
  agentName: string,
  domain: string,
  confidenceTier: "HIGH" | "MEDIUM" | "LOW",
): Promise<string | null> {
  if (confidenceTier === "HIGH") return null;
  const profile = await ensureProfile(agentName);
  if ((profile.weak_domains ?? []).includes(domain)) {
    return `Note: Bhudhi has limited reliability in ${domain}. Treat this as a starting point and validate with real execution proof.`;
  }
  if (confidenceTier === "LOW") {
    return "Note: Confidence is low for this assessment. Verify key assumptions before committing resources.";
  }
  return "Note: Medium confidence — cross-check recommendations against your latest signals.";
}

export async function getDomainReliabilityReport(): Promise<
  Array<{ agentName: string; domains: DomainReliability[]; accuracy: number }>
> {
  const rows = await db.select().from(metaCognitionProfiles);
  return rows.map(r => ({
    agentName: r.agent_name,
    domains: r.domain_reliability as DomainReliability[],
    accuracy: r.prediction_accuracy,
  }));
}

export async function runWeeklyCalibrationFromPredictions(): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select()
    .from(predictionLogs)
    .where(isNull(predictionLogs.verification_date));

  let calibrated = 0;
  for (const row of stale) {
    if (row.created_at >= weekAgo) continue;
    await recordOutcome(row.id, { status: "unverified", autoCalibrated: true });
    calibrated++;
  }

  logger.info({ calibrated }, "[MetaCognitionEngine] Weekly calibration");
  return calibrated;
}
