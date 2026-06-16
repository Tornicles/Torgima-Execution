import { z } from "zod";
import type { Doc12TriggerType } from "../TriggerRegistry.js";

export const StructuredGoalSchema = z.object({
  cleaned_goal: z.string().min(10).max(300),
  measurable_outcome: z.string().min(10).max(200),
  missing_fields: z.array(z.string()).default([]),
  feasibility_note: z.string().max(200).optional(),
  goal_is_clear: z.boolean(),
});

export const TaskCopySchema = z.object({
  title: z.string().min(5).max(120),
  instruction: z.string().min(20).max(500),
  expected_output: z.string().min(10).max(300),
  definition_of_done: z.string().min(10).max(300),
  why_it_matters: z.string().min(10).max(200),
  time_estimate_label: z.string().max(50).optional(),
  proof_description: z.string().max(200).optional(),
});

export const BlockerClassificationSchema = z.object({
  category: z.enum([
    "DEPENDENCY_MISSING",
    "EXTERNAL_WAIT",
    "CLARITY_NEEDED",
    "CAPABILITY_GAP",
    "RESOURCE_MISSING",
    "OTHER",
  ]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reasoning: z.string().max(200),
});

export const ClarificationRequestSchema = z.object({
  question: z.string().min(10).max(300),
  missing_field: z.string(),
  why_needed: z.string().max(200),
});

export const StateExplanationSchema = z.object({
  headline: z.string().min(5).max(100),
  explanation: z.string().min(20).max(400),
  what_is_allowed: z.array(z.string()).max(5),
  what_is_restricted: z.array(z.string()).max(5),
  recommended_next_action: z.string().max(200),
});

export const RecoveryCopySchema = z.object({
  title: z.string().min(5).max(100),
  welcome_back_message: z.string().min(10).max(300),
  first_step_description: z.string().min(10).max(200),
  tone: z.enum(["CALM", "ENCOURAGING", "NEUTRAL"]),
});

export const AcademyInstructionSchema = z.object({
  title: z.string().min(5).max(120),
  explanation: z.string().min(20).max(600),
  execution_requirement: z.string().min(10).max(300),
  proof_description: z.string().min(10).max(200),
  learning_type: z.enum([
    "CAPABILITY_ACTIVATION",
    "CORRECTION_LEARNING",
    "REINFORCEMENT_LEARNING",
    "SCALING_KNOWLEDGE",
    "STRATEGIC_KNOWLEDGE",
  ]),
});

export const RootCauseCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        category: z.enum([
          "CLARITY_FAILURE",
          "CAPABILITY_FAILURE",
          "CAPACITY_FAILURE",
          "DEPENDENCY_FAILURE",
          "MOTIVATION_FRICTION",
          "SYSTEM_FRICTION",
          "WRONG_PRIORITY",
          "OUTCOME_MISMATCH",
          "EXTERNAL_BLOCKER",
          "PROOF_FAILURE",
        ]),
        likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
        evidence: z.array(z.string()).max(3),
      }),
    )
    .min(1)
    .max(3),
  recommended_diagnostic_question: z.string().max(300).optional(),
});

export const EvidenceSummarySchema = z.object({
  summary: z.string().min(10).max(400),
  evidence_strength_label: z.enum(["STRONG", "MODERATE", "WEAK", "INSUFFICIENT"]),
  missing_evidence_description: z.string().max(300).optional(),
  recommended_next_evidence: z.string().max(200).optional(),
});

export const ProofRelevanceSchema = z.object({
  is_relevant: z.boolean(),
  relevance_score: z.number().min(0).max(100),
  explanation: z.string().max(200),
});

export const OUTPUT_SCHEMAS: Record<Doc12TriggerType, z.ZodTypeAny> = {
  GOAL_STRUCTURING: StructuredGoalSchema,
  TASK_DRAFTING: TaskCopySchema,
  BLOCKER_CLASSIFICATION: BlockerClassificationSchema,
  CLARIFICATION_PROMPT: ClarificationRequestSchema,
  STATE_EXPLANATION: StateExplanationSchema,
  RECOVERY_COPY: RecoveryCopySchema,
  ACADEMY_SUPPORT: AcademyInstructionSchema,
  ROOT_CAUSE_ASSIST: RootCauseCandidatesSchema,
  OUTCOME_EVIDENCE_SUMMARY: EvidenceSummarySchema,
  PROOF_RELEVANCE_CHECK: ProofRelevanceSchema,
};

export function validateDoc13Data(triggerType: Doc12TriggerType, data: unknown): {
  ok: boolean;
  data?: unknown;
  errors: string[];
} {
  const schema = OUTPUT_SCHEMAS[triggerType];
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data, errors: [] };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
  };
}
