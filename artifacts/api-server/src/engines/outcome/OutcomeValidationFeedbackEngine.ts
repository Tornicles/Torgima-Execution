/**
 * Prompt 7 §4 — Per-feedback outcome validation + false progress records.
 */
import { db, feedback, orders, outcomeValidationRecords, blueprints } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { getBasicProfile } from "../../bhudhi/agents/BehavioralAgent.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";

export type ValidationVerdict = "VALID" | "WEAK" | "INSUFFICIENT" | "SUSPICIOUS";
export type FalseProgressRisk = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface OutcomeValidationInput {
  userId: string;
  feedbackId: string;
  orderId: string;
  adversarialScore?: number;
}

export interface OutcomeValidationResult {
  proofQualityScore: number;
  falseProgressRisk: FalseProgressRisk;
  validationVerdict: ValidationVerdict;
  missingCriteria: string[];
  proofRequirementAdjusted: boolean;
  evidenceSummary: string;
}

function proofQuality(fb: typeof feedback.$inferSelect, order: typeof orders.$inferSelect): number {
  let score = 0;
  const proof = fb.proof_json as Record<string, unknown> | null;
  if (proof && Object.keys(proof).length > 0) score += 0.4;
  if ((fb.reflection?.length ?? 0) >= 30) score += 0.3;
  if (fb.completion_status === "completed") score += 0.2;
  if (order.proof_required && score < 0.4) score *= 0.5;
  return Math.min(1, score);
}

export async function validateFeedbackOutcome(
  input: OutcomeValidationInput,
): Promise<OutcomeValidationResult> {
  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, input.feedbackId))
    .limit(1);
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!fb || !order) {
    return {
      proofQualityScore: 0,
      falseProgressRisk: "NONE",
      validationVerdict: "INSUFFICIENT",
      missingCriteria: ["feedback", "order"],
      proofRequirementAdjusted: false,
      evidenceSummary: "Missing feedback or order",
    };
  }

  const profile = await getBasicProfile(input.userId).catch(() => null);
  const adversarial =
    input.adversarialScore ??
    Math.max(0, (profile?.averageScoreLast7Days ?? 5) / 10 - (profile?.completionRateLast7Days ?? 0.5));

  const pq = proofQuality(fb, order);

  const recent = await db
    .select({ completion_status: feedback.completion_status, score: feedback.score })
    .from(feedback)
    .where(
      and(eq(feedback.user_id, input.userId), gte(feedback.created_at, new Date(Date.now() - 14 * 86400000))),
    )
    .orderBy(desc(feedback.created_at))
    .limit(14);

  const completionRate =
    recent.filter((r) => r.completion_status === "completed").length / Math.max(1, recent.length);
  const avgScore =
    recent.reduce((s, r) => s + (r.score ?? 0), 0) / Math.max(1, recent.length) / 10;

  let falseProgressScore = 0;
  const divergence: Array<{ factor: string; value: number }> = [];
  if ((fb.score ?? 0) >= 9 && completionRate < 0.5) {
    falseProgressScore = 0.7;
    divergence.push({ factor: "high_score_low_completion", value: completionRate });
  }
  if (avgScore > 0.7 && completionRate < completionRate - 0.25) {
    falseProgressScore = Math.max(falseProgressScore, 0.5);
  }
  falseProgressScore = Math.max(falseProgressScore, adversarial * 0.5);

  const falseProgressRisk: FalseProgressRisk =
    falseProgressScore >= 0.6 ? "HIGH"
    : falseProgressScore >= 0.4 ? "MEDIUM"
    : falseProgressScore >= 0.2 ? "LOW"
    : "NONE";

  let validationVerdict: ValidationVerdict;
  if (pq >= 0.7 && adversarial < 0.4) validationVerdict = "VALID";
  else if (pq >= 0.4 && adversarial < 0.6) validationVerdict = "WEAK";
  else if (pq < 0.4 || (order.proof_required && !fb.proof_json)) validationVerdict = "INSUFFICIENT";
  else if (adversarial >= 0.6 && pq > 0.7) validationVerdict = "SUSPICIOUS";
  else validationVerdict = "WEAK";

  const missingCriteria: string[] = [];
  if (pq < 0.7) missingCriteria.push("Stronger proof of execution");
  if ((fb.reflection?.length ?? 0) < 30) missingCriteria.push("Deeper reflection");

  const priorSuspicious = await db
    .select()
    .from(outcomeValidationRecords)
    .where(
      and(
        eq(outcomeValidationRecords.user_id, input.userId),
        eq(outcomeValidationRecords.validation_verdict, "INSUFFICIENT"),
      ),
    )
    .orderBy(desc(outcomeValidationRecords.created_at))
    .limit(2);

  const proofRequirementAdjusted =
    validationVerdict === "SUSPICIOUS" ||
    (priorSuspicious.length >= 1 && validationVerdict === "INSUFFICIENT");

  let evidenceSummary = `${validationVerdict} — proof quality ${Math.round(pq * 100)}%`;
  const proofText =
    typeof fb.proof_json === "object" && fb.proof_json !== null && "text" in fb.proof_json
      ? String((fb.proof_json as { text: unknown }).text ?? "")
      : "";

  if (proofText.length > 10) {
    try {
      const [bp] = await db
        .select({ state_version: blueprints.state_version })
        .from(blueprints)
        .where(eq(blueprints.id, order.blueprint_id))
        .limit(1);

      const bhudhi = await routeBhudhiRequest({
        sourceEngine: "OUTCOME_VALIDATION",
        triggerType: "OUTCOME_EVIDENCE_SUMMARY",
        requestedMode: "INTERPRET",
        userId: input.userId,
        blueprintId: order.blueprint_id,
        stateVersion: bp?.state_version ?? 0,
        idempotencyKey: `outcome_evidence:${input.feedbackId}`,
        facts: {
          proofText,
          reflection: fb.reflection ?? "",
          completionStatus: fb.completion_status,
        },
      });

      const summary = (bhudhi.output?.data as { summary?: string } | undefined)?.summary;
      if (summary?.trim()) {
        evidenceSummary = summary.trim().slice(0, 500);
      }
    } catch {
      /* deterministic summary retained */
    }

    await db
      .update(feedback)
      .set({
        proof_json: {
          ...(fb.proof_json as Record<string, unknown>),
          outcomeEvidenceSummary: evidenceSummary,
        },
      })
      .where(eq(feedback.id, input.feedbackId));
  }

  await db.insert(outcomeValidationRecords).values({
    user_id: input.userId,
    order_id: input.orderId,
    feedback_id: input.feedbackId,
    proof_quality_score: pq,
    proof_type: fb.proof_json ? "structured" : "reflection_only",
    missing_criteria: missingCriteria,
    false_progress_risk: falseProgressRisk,
    false_progress_score: falseProgressScore,
    divergence_factors: divergence,
    validation_verdict: validationVerdict,
    proof_requirement_adjusted: proofRequirementAdjusted,
  });

  if (proofRequirementAdjusted) {
    await db
      .update(orders)
      .set({ proof_required: true })
      .where(eq(orders.user_id, input.userId));
  }

  return {
    proofQualityScore: pq,
    falseProgressRisk,
    validationVerdict,
    missingCriteria,
    proofRequirementAdjusted,
    evidenceSummary,
  };
}

export async function adjustProofRequirement(userId: string, validationVerdict: string) {
  if (validationVerdict !== "SUSPICIOUS" && validationVerdict !== "INSUFFICIENT") {
    return { adjusted: false };
  }
  await db.update(orders).set({ proof_required: true }).where(eq(orders.user_id, userId));
  return { adjusted: true };
}
