import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  erectorDecisionAudits,
  erectorIntakeSessions,
  erectorUserFacingExplanations,
  erectorValidationRuns,
} from "@workspace/db";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";
import type {
  DimensionScores,
  FinalVerdictDecision,
  RuleEvaluationResult,
  ValidationPathPayload,
} from "./types/verdict-types.js";

function generatePaths(
  verdict: FinalVerdictDecision,
  scores: DimensionScores,
): {
  current: ValidationPathPayload;
  adjusted: ValidationPathPayload;
  alternative: ValidationPathPayload;
} {
  const baseProbability = Math.max(0.05, Math.min(0.9, scores.overall_validation_score / 100));
  const currentDisabled = verdict.verdict === "PIVOT";
  return {
    current: {
      pathType: "current",
      title: "Current Path",
      summary: "Proceed with your stated plan under current assumptions.",
      rationale: "Best fit when validation score and demand proof are already strong.",
      modifications: [],
      probabilityOfSuccess: Number(baseProbability.toFixed(2)),
      disabled: currentDisabled,
      disabledReason: currentDisabled ? "Your recommendation requires a direction change first." : undefined,
    },
    adjusted: {
      pathType: "adjusted",
      title: "Adjusted Path",
      summary: "Keep the goal but narrow scope and strengthen proof before launch.",
      rationale: "Removes the weaknesses identified by the rule engine.",
      modifications: verdict.correction_fields.length
        ? verdict.correction_fields
        : ["Narrow target customer", "Extend timeline", "Increase proof cadence"],
      probabilityOfSuccess: Number(Math.min(0.95, baseProbability + 0.12).toFixed(2)),
      disabled: false,
    },
    alternative: {
      pathType: "alternative",
      title: "Alternative Path",
      summary: "Pursue a lower-risk wedge toward the same outcome.",
      rationale: "Used when feasibility or contradictions block the current plan.",
      modifications: ["Change wedge", "Lower capital exposure", "Validate demand first"],
      probabilityOfSuccess: Number(Math.min(0.95, baseProbability + 0.18).toFixed(2)),
      disabled: false,
    },
  };
}

function verdictCustomerLabel(verdict: string): string {
  if (verdict === "PROCEED") return "proceed";
  if (verdict === "ADJUST") return "adjust";
  return "pivot";
}

function dimensionLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Limited";
  return "Weak";
}

/** Gap Fix 1 — customer-facing free tier preview report (demand proof omitted). */
export function buildFreeTierPreviewReport(
  finalVerdict: FinalVerdictDecision,
  scores: DimensionScores,
): {
  badge: string;
  verdict_headline: string;
  market_potential: string;
  resource_fit: string;
  whats_missing: string;
  upgrade_cta: string;
  user_facing_explanation: string;
  show_demand_proof: false;
} {
  const label =
    finalVerdict.preview_verdict_label ??
    (finalVerdict.verdict === "PROCEED"
      ? "Good Potential"
      : finalVerdict.verdict === "ADJUST"
        ? "Some Gaps to Address"
        : "Key Issues Worth Reviewing");

  const explanation = [
    "Project Intelligence Preview",
    `Your project shows ${label}.`,
    `Market Potential: ${dimensionLabel(scores.market_viability_score)}.`,
    `Resource Fit: ${dimensionLabel(scores.feasibility_score)}.`,
    "A full analysis would evaluate your specific customers, revenue model, skills, prior experience, and six more dimensions.",
    "Upgrade for full validation with archetype-specific intelligence.",
  ].join(" ");

  return {
    badge: "Project Intelligence Preview",
    verdict_headline: `Your project shows ${label}`,
    market_potential: dimensionLabel(scores.market_viability_score),
    resource_fit: dimensionLabel(scores.feasibility_score),
    whats_missing:
      "A full analysis would evaluate: your specific customers, how you make money, your skills, prior experience, and 6 more dimensions.",
    upgrade_cta: "Upgrade for full validation to unlock demand proof, context readiness, and archetype-specific rules.",
    user_facing_explanation: explanation,
    show_demand_proof: false,
  };
}

async function explainVerdict(
  userId: string,
  validationRunId: string,
  verdict: FinalVerdictDecision,
  scores: DimensionScores,
  ruleResults: RuleEvaluationResult,
): Promise<{ explanationId: string; summary: string; reason: string }> {
  const isPreview = verdict.is_free_tier_preview === true;
  const previewReport = isPreview ? buildFreeTierPreviewReport(verdict, scores) : null;

  const facts = isPreview
    ? {
        preview_badge: previewReport!.badge,
        preview_verdict_label: verdict.preview_verdict_label,
        market_viability_score: scores.market_viability_score,
        feasibility_score: scores.feasibility_score,
        overall_validation_score: scores.overall_validation_score,
        hard_blockers: ruleResults.hard_blockers,
        soft_warnings: ruleResults.soft_warnings,
        upgrade_required: true,
        stateVersion: 0,
      }
    : {
        verdict: verdictCustomerLabel(verdict.verdict),
        scores,
        hard_blockers: ruleResults.hard_blockers,
        correction_required: verdict.correction_fields.join(", ") || "none",
        stateVersion: 0,
      };

  let summary = isPreview
    ? previewReport!.verdict_headline
    : `Your project needs a ${verdictCustomerLabel(verdict.verdict)} path.`;
  let reason = isPreview
    ? previewReport!.user_facing_explanation
    : verdict.reasoning.join(" ");

  const triggerType = isPreview ? "ERECTOR_FREE_VERDICT_EXPLAIN" : "ERECTOR_VERDICT_EXPLANATION";
  const fallbackKey = isPreview
    ? "ERECTOR_FREE_VERDICT_EXPLAIN_FALLBACK"
    : "ERECTOR_VERDICT_EXPLANATION_FALLBACK";

  try {
    const result = await routeBhudhiRequest<{
      headline?: string;
      explanation?: string;
      user_facing_summary?: string;
      plain_language_reason?: string;
    }>({
      sourceEngine: "erector_rule_engine",
      triggerType,
      userId,
      stateVersion: 0,
      requestedMode: "EXPLAIN",
      idempotencyKey: `erector-verdict-explain:${validationRunId}`,
      facts,
    });

    const data = result.output?.data;
    if (data && typeof data === "object") {
      summary = String(data.user_facing_summary ?? data.headline ?? summary);
      reason = String(data.plain_language_reason ?? data.explanation ?? reason);
    }
  } catch {
    const envelope = getFallback(fallbackKey, facts, 0);
    const data = envelope.data as { user_facing_summary?: string; plain_language_reason?: string };
    summary = data.user_facing_summary ?? summary;
    reason = data.plain_language_reason ?? reason;
  }

  const [explanation] = await db
    .insert(erectorUserFacingExplanations)
    .values({
      user_id: userId,
      user_facing_summary: summary,
      plain_language_reason: reason,
      blocker_type: verdict.verdict === "PIVOT" ? "hard_blocker" : verdict.requires_correction ? "soft_blocker" : null,
      correction_required: verdict.correction_fields.join(", ") || null,
    })
    .returning({ id: erectorUserFacingExplanations.id });

  return {
    explanationId: explanation?.id ?? randomUUID(),
    summary,
    reason,
  };
}

export async function issueVerdict(
  validationRunId: string,
  userId: string,
  sessionId: string,
  finalVerdict: FinalVerdictDecision,
  scores: DimensionScores,
  ruleResults: RuleEvaluationResult,
  profileId: string,
): Promise<{ explanation_id: string }> {
  const paths = generatePaths(finalVerdict, scores);
  const decisionId = `verdict_${validationRunId}`;

  const explanation = await explainVerdict(userId, validationRunId, finalVerdict, scores, ruleResults);

  await db
    .update(erectorValidationRuns)
    .set({
      verdict: finalVerdict.verdict,
      verdict_confidence: finalVerdict.verdict === "PROCEED" ? "high" : "medium",
      market_viability_score: scores.market_viability_score,
      demand_proof_score: scores.demand_proof_score,
      feasibility_score: scores.feasibility_score,
      context_readiness_score: scores.context_readiness_score,
      contradiction_score: scores.contradiction_score,
      evidence_quality_score: scores.evidence_quality_score,
      overall_validation_score: scores.overall_validation_score,
      demand_proof_class: scores.demand_proof_class,
      feasibility_rating: scores.feasibility_rating,
      path_current: paths.current,
      path_adjusted: paths.adjusted,
      path_alternative: paths.alternative,
      selected_path: finalVerdict.recommended_path,
      rules_applied: ruleResults.rules_fired,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
      requires_correction: finalVerdict.requires_correction,
      correction_fields: finalVerdict.correction_fields,
      status: finalVerdict.verdict === "PIVOT" ? "complete" : "complete",
      completed_at: new Date(),
      reality_profile_id: profileId,
    })
    .where(eq(erectorValidationRuns.id, validationRunId));

  await db.insert(erectorDecisionAudits).values({
    decision_id: decisionId,
    decision_type: "validation_verdict",
    source_engine: "erector_rule_engine",
    user_id: userId,
    entity_type: "erector_validation_run",
    entity_id: validationRunId,
    input_snapshot: {
      profile_id: profileId,
      scores,
      rules_fired: ruleResults.rules_fired,
    },
    rules_applied: ruleResults.rules_fired,
    result: finalVerdict.verdict,
    result_detail: {
      reasoning: finalVerdict.reasoning,
      recommended_path: finalVerdict.recommended_path,
      paths,
      ...(finalVerdict.is_free_tier_preview
        ? { preview_report: buildFreeTierPreviewReport(finalVerdict, scores) }
        : {}),
    },
    explanation_id: explanation.explanationId,
    downstream_effects: ["erector_validation_completed"],
    user_visible: true,
  });

  await db
    .update(erectorUserFacingExplanations)
    .set({ decision_audit_id: decisionId })
    .where(eq(erectorUserFacingExplanations.id, explanation.explanationId));

  await db
    .update(erectorIntakeSessions)
    .set({ validation_id: validationRunId })
    .where(eq(erectorIntakeSessions.id, sessionId));

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_VALIDATION_COMPLETED,
    entityType: "erector_validation_run",
    entityId: validationRunId,
    userId,
    payload: {
      validation_run_id: validationRunId,
      session_id: sessionId,
      profile_id: profileId,
      verdict: finalVerdict.verdict,
      paths,
      explanation_id: explanation.explanationId,
      overall_validation_score: scores.overall_validation_score,
    },
    idempotencyKey: `erector_validation_completed:${validationRunId}`,
  });

  return { explanation_id: explanation.explanationId };
}
