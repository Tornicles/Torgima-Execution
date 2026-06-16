/**
 * DOC22 — Failure classification orchestrator.
 */

import { db, feedback, behaviorEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { traceDecision, getBlueprintStateVersion } from "../decision-trace/DecisionTraceSystem.js";
import { DecisionTraceService } from "../decision/DecisionTraceService.js";
import { loadFailureEvidence } from "./FailureEvidence.js";
import {
  scoreAll,
  confidenceFromReflection,
  baseSeverityFromScore,
  escalateSeverityLevel,
} from "./RootCauseScorer.js";
import { checkRepeatFailure } from "./RepeatFailureDetector.js";
import {
  correctionTypeToTaskType,
  routeCorrection,
  CORRECTION_ROUTES,
} from "./CorrectionRouter.js";
import type {
  FailureCategory,
  ClassificationConfidence,
  ClassificationSeverity,
} from "./failureTypes.js";

export {
  FAILURE_CATEGORIES,
  type FailureCategory,
  type ClassificationConfidence,
  type ClassificationSeverity,
} from "./failureTypes.js";
export { correctionTypeToTaskType, CORRECTION_ROUTES };

export interface ClassificationResult {
  primaryCategory: FailureCategory;
  secondaryCategories: FailureCategory[];
  confidence: ClassificationConfidence;
  severity: ClassificationSeverity;
  repeatFailure: boolean;
  correctionType: string;
  correctionTaskType: string;
  evidenceSummary: string;
  correctionRouted: boolean;
}

export async function persistFailureClassificationOnFeedback(params: {
  feedbackId: string;
  primaryCategory: FailureCategory;
  correctionTaskType: string;
}): Promise<void> {
  await db
    .update(feedback)
    .set({
      failure_classification: params.primaryCategory,
      failure_correction_type: params.correctionTaskType,
    })
    .where(eq(feedback.id, params.feedbackId));
}

async function writePatternBehaviorEvent(params: {
  userId: string;
  blueprintId: string;
  category: FailureCategory;
  sourceId: string;
}): Promise<void> {
  await db
    .insert(behaviorEvents)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      event_type: "failure_pattern_signal",
      data_json: {
        category: params.category,
        source_id: params.sourceId,
      },
    })
    .catch(() => null);
}

export async function classifyFailure(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
}): Promise<ClassificationResult> {
  const evidence = await loadFailureEvidence(params);

  if (!evidence) {
    const correctionType = "clarification_task_requested";
    return {
      primaryCategory: "CLARITY_FAILURE",
      secondaryCategories: [],
      confidence: "LOW",
      severity: "LOW",
      repeatFailure: false,
      correctionType,
      correctionTaskType: correctionTypeToTaskType(correctionType),
      evidenceSummary: "Insufficient data to classify",
      correctionRouted: false,
    };
  }

  const scores = scoreAll(evidence);
  let primaryCategory = scores[0]!.category;
  const secondaryCategories = scores
    .slice(1, 3)
    .filter((s) => s.score >= 30)
    .map((s) => s.category);

  let confidence = confidenceFromReflection(evidence.feedbackReflectionLength);
  let severity = baseSeverityFromScore(scores[0]!.score);

  const repeat = await checkRepeatFailure({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    feedbackId: params.feedbackId,
    primaryCategory,
  });

  if (repeat.forceClarityForSameOrder) {
    primaryCategory = "CLARITY_FAILURE";
  }

  if (repeat.escalateConfidence && confidence === "MEDIUM") {
    confidence = "HIGH";
  }

  if (repeat.escalateSeverity) {
    severity = escalateSeverityLevel(severity);
  }

  if (repeat.repeatFailure && confidence === "HIGH" && severity === "MEDIUM") {
    severity = "HIGH";
  }

  const stateVersion = await getBlueprintStateVersion(params.blueprintId).catch(() => 0);

  await DecisionTraceService.write({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    decisionType: "SYSTEM_CORRECTION",
    decisionKey: `failure_classification:${params.feedbackId}`,
    selectedOption: primaryCategory,
    optionsConsidered: scores.map((s) => s.category),
    rationaleSummary: `Primary: ${primaryCategory} (score: ${scores[0]!.score}). Evidence: ${evidence.summary}`,
    sourceEngine: "FailureClassificationEngine",
    confidence,
    stateVersion,
    causationEventId: params.feedbackId,
    evidenceIds: [params.orderId, params.feedbackId],
  }).catch(() => null);

  await traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: "failure_classification",
    contextType: "FEEDBACK",
    contextId: params.feedbackId,
    engineSource: "FailureClassificationEngine",
    rationale: `Primary: ${primaryCategory} (score: ${scores[0]!.score}). Evidence: ${evidence.summary}`,
    outcome: CORRECTION_ROUTES[primaryCategory].correctionType,
    evidenceIds: [params.orderId, params.feedbackId],
    alternatives: scores.map((s) => s.category),
    stateVersion,
    inputSummary: JSON.stringify({ confidence, severity, repeat: repeat.repeatFailure }).slice(0, 500),
    outputSummary: primaryCategory,
  }).catch(() => null);

  if (["CAPABILITY_FAILURE", "CAPACITY_FAILURE", "MOTIVATION_FRICTION"].includes(primaryCategory)) {
    await writePatternBehaviorEvent({
      userId: params.userId,
      blueprintId: params.blueprintId,
      category: primaryCategory,
      sourceId: params.feedbackId,
    });
  }

  const route = await routeCorrection({
    primaryCategory,
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    feedbackId: params.feedbackId,
    severity,
    repeat,
  });

  logger.info(
    {
      blueprintId: params.blueprintId,
      primary: primaryCategory,
      confidence,
      severity,
      correction: route.correctionType,
      routed: route.routed,
      topScore: scores[0]!.score,
    },
    "[FailureEngine] Classified",
  );

  return {
    primaryCategory,
    secondaryCategories,
    confidence,
    severity,
    repeatFailure: repeat.repeatFailure,
    correctionType: route.correctionType,
    correctionTaskType: route.correctionTaskType,
    evidenceSummary: `${primaryCategory} detected with ${confidence} confidence (score ${scores[0]!.score})`,
    correctionRouted: route.routed,
  };
}

/** IL3 — class wrapper for DOC_22 wiring. */
export class FailureClassificationEngine {
  classify(params: {
    userId: string;
    blueprintId: string;
    orderId: string;
    feedbackId: string;
  }): Promise<ClassificationResult> {
    return classifyFailure(params);
  }
}

export const failureClassificationEngine = new FailureClassificationEngine();
