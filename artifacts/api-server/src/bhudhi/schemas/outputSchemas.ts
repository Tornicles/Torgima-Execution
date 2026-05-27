/**
 * Bhudhi B2 — Zod output schemas for prompt contracts and fallbacks.
 */
import { z } from "zod";

export const confidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export function envelopeSchema<T extends z.ZodTypeAny>(
  outputType: string,
  dataSchema: T,
) {
  return z.object({
    outputType: z.literal(outputType),
    contractVersion: z.string().min(1),
    stateVersion: z.number(),
    confidence: confidenceSchema,
    data: dataSchema,
    missingFields: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
    forbiddenActionRequested: z.literal(false).or(z.literal(true)),
  });
}

// ── Core Phase 1 data shapes ─────────────────────────────────────────────────

export const structuredGoalDataSchema = z.object({
  cleanedGoal: z.string().min(1),
  purpose: z.string().optional(),
  timeframe: z.string().optional(),
  commitmentLevel: z.enum(["LOW", "MEDIUM", "HIGH", "INTENSE"]).optional(),
  domainHints: z.array(z.string()).default([]),
  ambiguityFlags: z.array(z.string()).default([]),
  missingRequiredFields: z.array(z.string()).default([]),
  suggestedClarifyingQuestion: z.string().nullable().optional(),
  primaryDomain: z.string().optional(),
  industryLabel: z.string().optional(),
  nicheLabel: z.string().optional(),
});

export const goalMissingFieldsDataSchema = structuredGoalDataSchema.extend({
  missingFields: z.array(z.string()).min(1),
  questionToAsk: z.string().min(1),
  priority: z.enum(["goal", "purpose", "timeframe", "commitment", "context"]),
});

export const taskCopyDataSchema = z
  .object({
    title: z.string().min(1),
    instruction: z.string().optional(),
    proofInstruction: z.string().optional(),
    successCriteria: z.array(z.string()).optional(),
    estimatedEffortLabel: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
    userFacingReason: z.string().optional(),
    command: z.string().optional(),
    requiredOutput: z.string().optional(),
    doneCriteria: z.string().optional(),
    proof: z.string().optional(),
    where: z.string().optional(),
    how: z.string().optional(),
    unlockConsequence: z.string().optional(),
    expectedOutput: z.string().optional(),
    whyItMatters: z.string().optional(),
    proofGuidance: z.string().optional(),
  })
  .refine((d) => Boolean(d.instruction || d.command), {
    message: "task_copy requires instruction or command",
  });

export const clarificationDataSchema = z.object({
  question: z.string().min(1),
  requiredField: z.string().min(1),
  answerType: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "CHOICE"]),
  choices: z.array(z.string()).default([]),
  whyNeeded: z.string().optional(),
  missingField: z.string().optional(),
  context: z.string().optional(),
  targetField: z.string().optional(),
  reason: z.string().optional(),
});

export const recoveryCopyDataSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  expectedOutput: z.string().optional(),
  tone: z.enum(["CALM", "WARM", "DIRECT", "RECOVERY", "FOCUSED"]),
  recoveryReason: z.string().optional(),
});

export const restartCopyDataSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  welcomeMessage: z.string().min(1),
  daysInactive: z.number().optional(),
});

export const blockerClassificationDataSchema = z.object({
  blockerCategory: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  needsDependencyResolution: z.boolean().optional(),
  needsRecoveryTask: z.boolean().optional(),
  summary: z.string().min(1),
  suggestedResolution: z.string().optional(),
});

export const stateExplanationDataSchema = z.object({
  headline: z.string().min(1),
  explanation: z.string().min(1),
  nextActionReason: z.string().min(1),
  displayTone: z.enum(["CALM", "DIRECT", "RECOVERY", "FOCUSED", "WARM"]),
  bodyText: z.string().optional(),
  nextActionSuggestion: z.string().nullable().optional(),
});

export const evidenceSummaryDataSchema = z.object({
  submittedEvidenceSummary: z.string().min(1),
  validationRecommendation: z.enum(["ENOUGH_TO_REVIEW", "NEEDS_MORE_EVIDENCE", "UNCLEAR"]),
  credibilityScore: z.number().min(0).max(1).optional(),
  gaps: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const academyInstructionDataSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  practiceTask: z.string().optional(),
  proofOfUnderstanding: z.string().optional(),
  expectedOutput: z.string().optional(),
  masteryDefinition: z.string().optional(),
  proofRequirement: z.string().optional(),
  whyThisSkillMatters: z.string().optional(),
  concept: z.string().optional(),
  explanation: z.string().optional(),
  practicePrompt: z.string().nullable().optional(),
  capabilityGap: z.string().nullable().optional(),
});

export const rootCauseDataSchema = z.object({
  candidates: z
    .array(
      z.object({
        category: z.string().min(1),
        likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
        evidence: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  recommendedNextDiagnosticQuestion: z.string().min(1),
  primaryCandidate: z.string().optional(),
  alternativeCandidates: z.array(z.string()).optional(),
});

// ── Envelope schemas keyed by outputType ─────────────────────────────────────

const externalIntelligenceDataSchema = z.object({
  marketTrends: z.array(z.string()).default([]),
  opportunitySignals: z.array(z.string()).default([]),
  riskSignals: z.array(z.string()).default([]),
  competitorMoves: z.array(z.string()).default([]),
  executionRecommendation: z.string().default(""),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
});

const predictiveAnalysisDataSchema = z.object({
  primaryRisk: z.string().nullable().optional(),
  primaryOpportunity: z.string().nullable().optional(),
});

export const OUTPUT_ENVELOPE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  structured_goal: envelopeSchema("structured_goal", structuredGoalDataSchema),
  external_intelligence: envelopeSchema("external_intelligence", externalIntelligenceDataSchema),
  predictive_analysis: envelopeSchema("predictive_analysis", predictiveAnalysisDataSchema),
  task_copy: envelopeSchema("task_copy", taskCopyDataSchema),
  clarification_request: envelopeSchema("clarification_request", clarificationDataSchema),
  recovery_copy: envelopeSchema("recovery_copy", recoveryCopyDataSchema),
  restart_copy: envelopeSchema("restart_copy", restartCopyDataSchema),
  blocker_classification: envelopeSchema("blocker_classification", blockerClassificationDataSchema),
  state_explanation: envelopeSchema("state_explanation", stateExplanationDataSchema),
  evidence_summary: envelopeSchema("evidence_summary", evidenceSummaryDataSchema),
  academy_instruction: envelopeSchema("academy_instruction", academyInstructionDataSchema),
  root_cause_candidates: envelopeSchema("root_cause_candidates", rootCauseDataSchema),
};

/** Core trigger types required by B2 (9 approved + variants). */
export const CORE_TRIGGER_TYPES = [
  "GOAL_STRUCTURING",
  "TASK_DRAFTING",
  "FEEDBACK_CLASSIFICATION",
  "CLARIFICATION_PROMPT",
  "RECOVERY_COPY",
  "STATE_EXPLANATION",
  "INACTIVITY_RESTART",
  "ACADEMY_SUPPORT",
  "OUTCOME_EVIDENCE_SUMMARY",
  "ROOT_CAUSE_ASSIST",
] as const;
