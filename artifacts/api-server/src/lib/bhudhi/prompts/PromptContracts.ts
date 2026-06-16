import type { BhudhiMode } from "../../../types/bhudhi.js";
import { REGISTERED_TRIGGERS, type Doc12TriggerType } from "../TriggerRegistry.js";
import { OUTPUT_SCHEMAS } from "../schemas/OutputSchemas.js";
import { buildSystemPrompt } from "./SystemPromptBuilder.js";

export interface Doc13PromptContract {
  triggerType: Doc12TriggerType;
  mode: BhudhiMode;
  outputSchema: (typeof OUTPUT_SCHEMAS)[Doc12TriggerType];
  buildSystemPrompt: (ctx?: Record<string, unknown>) => string;
  buildUserPrompt: (ctx: Record<string, unknown>) => string;
}

function jsonOnlyFooter(schemaHint: string): string {
  return `Respond ONLY with valid JSON for this data shape (no markdown):\n${schemaHint}`;
}

export const PROMPT_CONTRACTS: Record<Doc12TriggerType, Doc13PromptContract> = {
  GOAL_STRUCTURING: {
    triggerType: "GOAL_STRUCTURING",
    mode: "STRUCTURE",
    outputSchema: OUTPUT_SCHEMAS.GOAL_STRUCTURING,
    buildSystemPrompt: () => buildSystemPrompt("STRUCTURE", "GOAL_STRUCTURING"),
    buildUserPrompt: (ctx) =>
      `Structure this goal.\nraw_goal: ${String(ctx.raw_goal ?? ctx.rawGoal ?? "")}\nraw_purpose: ${String(ctx.raw_purpose ?? ctx.purpose ?? "")}\ntier: ${String(ctx.tier ?? "starter")}\n${jsonOnlyFooter("cleaned_goal, measurable_outcome, missing_fields, feasibility_note?, goal_is_clear")}`,
  },
  TASK_DRAFTING: {
    triggerType: "TASK_DRAFTING",
    mode: "DRAFT",
    outputSchema: OUTPUT_SCHEMAS.TASK_DRAFTING,
    buildSystemPrompt: () => buildSystemPrompt("DRAFT", "TASK_DRAFTING"),
    buildUserPrompt: (ctx) =>
      `Draft task copy.\naction_type: ${String(ctx.action_type ?? ctx.actionType ?? "execution")}\ndomain: ${String(ctx.domain ?? "delivery")}\ncondition: ${String(ctx.condition ?? "stability")}\ntier: ${String(ctx.tier ?? "starter")}\n${jsonOnlyFooter("title, instruction, expected_output, definition_of_done, why_it_matters, time_estimate_label?, proof_description?")}`,
  },
  BLOCKER_CLASSIFICATION: {
    triggerType: "BLOCKER_CLASSIFICATION",
    mode: "INTERPRET",
    outputSchema: OUTPUT_SCHEMAS.BLOCKER_CLASSIFICATION,
    buildSystemPrompt: () => buildSystemPrompt("INTERPRET", "BLOCKER_CLASSIFICATION"),
    buildUserPrompt: (ctx) =>
      `Classify blocker.\nblocker_description: ${String(ctx.blocker_description ?? ctx.feedbackText ?? "")}\ntask_type: ${String(ctx.task_type ?? ctx.taskType ?? "execution")}\n${jsonOnlyFooter("category, confidence, reasoning")}`,
  },
  CLARIFICATION_PROMPT: {
    triggerType: "CLARIFICATION_PROMPT",
    mode: "DRAFT",
    outputSchema: OUTPUT_SCHEMAS.CLARIFICATION_PROMPT,
    buildSystemPrompt: () => buildSystemPrompt("DRAFT", "CLARIFICATION_PROMPT"),
    buildUserPrompt: (ctx) =>
      `Ask one clarification question.\nmissing_field: ${String(ctx.missing_field ?? ctx.requiredField ?? "output_description")}\ntask_title: ${String(ctx.task_title ?? ctx.taskTitle ?? "current task")}\n${jsonOnlyFooter("question, missing_field, why_needed")}`,
  },
  STATE_EXPLANATION: {
    triggerType: "STATE_EXPLANATION",
    mode: "EXPLAIN",
    outputSchema: OUTPUT_SCHEMAS.STATE_EXPLANATION,
    buildSystemPrompt: () => buildSystemPrompt("EXPLAIN", "STATE_EXPLANATION"),
    buildUserPrompt: (ctx) =>
      `Explain project status in customer language.\ncondition: ${String(ctx.condition ?? "")}\nsignal_summary: ${String(ctx.signal_summary ?? ctx.trend ?? "")}\nnext_action: ${String(ctx.next_action ?? ctx.currentTaskTitle ?? "")}\n${jsonOnlyFooter("headline, explanation, what_is_allowed, what_is_restricted, recommended_next_action")}`,
  },
  RECOVERY_COPY: {
    triggerType: "RECOVERY_COPY",
    mode: "DRAFT",
    outputSchema: OUTPUT_SCHEMAS.RECOVERY_COPY,
    buildSystemPrompt: () => buildSystemPrompt("DRAFT", "RECOVERY_COPY"),
    buildUserPrompt: (ctx) =>
      `Write recovery re-entry copy.\ninactivity_type: ${String(ctx.inactivity_type ?? ctx.inactivityType ?? "moderate")}\ndays_inactive: ${String(ctx.days_inactive ?? ctx.daysInactive ?? 0)}\ntier: ${String(ctx.tier ?? "starter")}\n${jsonOnlyFooter("title, welcome_back_message, first_step_description, tone")}`,
  },
  ACADEMY_SUPPORT: {
    triggerType: "ACADEMY_SUPPORT",
    mode: "EXPLAIN",
    outputSchema: OUTPUT_SCHEMAS.ACADEMY_SUPPORT,
    buildSystemPrompt: () => buildSystemPrompt("EXPLAIN", "ACADEMY_SUPPORT"),
    buildUserPrompt: (ctx) =>
      `Write academy instruction.\ncapability_name: ${String(ctx.capability_name ?? ctx.capabilityGap ?? "")}\ndomain: ${String(ctx.domain ?? "delivery")}\nlearning_type: ${String(ctx.learning_type ?? "CAPABILITY_ACTIVATION")}\n${jsonOnlyFooter("title, explanation, execution_requirement, proof_description, learning_type")}`,
  },
  ROOT_CAUSE_ASSIST: {
    triggerType: "ROOT_CAUSE_ASSIST",
    mode: "SUGGEST",
    outputSchema: OUTPUT_SCHEMAS.ROOT_CAUSE_ASSIST,
    buildSystemPrompt: () => buildSystemPrompt("SUGGEST", "ROOT_CAUSE_ASSIST"),
    buildUserPrompt: (ctx) =>
      `Suggest root cause candidates.\nfailure_evidence: ${String(ctx.failure_evidence ?? ctx.evidence ?? "")}\ntask_type: ${String(ctx.task_type ?? ctx.taskType ?? "execution")}\ncondition: ${String(ctx.condition ?? "stability")}\n${jsonOnlyFooter("candidates[{category, likelihood, evidence}], recommended_diagnostic_question?")}`,
  },
  OUTCOME_EVIDENCE_SUMMARY: {
    triggerType: "OUTCOME_EVIDENCE_SUMMARY",
    mode: "EXPLAIN",
    outputSchema: OUTPUT_SCHEMAS.OUTCOME_EVIDENCE_SUMMARY,
    buildSystemPrompt: () => buildSystemPrompt("EXPLAIN", "OUTCOME_EVIDENCE_SUMMARY"),
    buildUserPrompt: (ctx) =>
      `Summarize submitted evidence.\nevidence_class: ${String(ctx.evidence_class ?? ctx.evidenceClass ?? "progress")}\nevidence_summary: ${String(ctx.evidence_summary ?? ctx.submittedEvidence ?? "")}\ntarget_metric: ${String(ctx.target_metric ?? ctx.successMetric ?? "")}\n${jsonOnlyFooter("summary, evidence_strength_label, missing_evidence_description?, recommended_next_evidence?")}`,
  },
  PROOF_RELEVANCE_CHECK: {
    triggerType: "PROOF_RELEVANCE_CHECK",
    mode: "INTERPRET",
    outputSchema: OUTPUT_SCHEMAS.PROOF_RELEVANCE_CHECK,
    buildSystemPrompt: () => buildSystemPrompt("INTERPRET", "PROOF_RELEVANCE_CHECK"),
    buildUserPrompt: (ctx) =>
      `Assess proof relevance.\nproof_description: ${String(ctx.proof_description ?? ctx.proofText ?? "")}\ntask_title: ${String(ctx.task_title ?? ctx.taskTitle ?? "")}\nexpected_output: ${String(ctx.expected_output ?? ctx.expectedOutput ?? "")}\n${jsonOnlyFooter("is_relevant, relevance_score, explanation")}`,
  },
};

export function getPromptContract(triggerType: Doc12TriggerType): Doc13PromptContract {
  return PROMPT_CONTRACTS[triggerType];
}

export function listPromptContracts(): Doc12TriggerType[] {
  return Object.keys(PROMPT_CONTRACTS) as Doc12TriggerType[];
}

export function assertPromptRegistryMatchesRouter(): void {
  for (const trigger of Object.keys(REGISTERED_TRIGGERS) as Doc12TriggerType[]) {
    if (!PROMPT_CONTRACTS[trigger]) {
      throw new Error(`Missing DOC13 prompt contract for ${trigger}`);
    }
  }
}
