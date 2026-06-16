import type { BhudhiOutputEnvelope, BhudhiOutputType } from "../../../types/bhudhi.js";
import { REGISTERED_TRIGGERS, type Doc12TriggerType } from "../TriggerRegistry.js";
import { OUTPUT_SCHEMAS } from "../schemas/OutputSchemas.js";

export interface Doc13FallbackResult {
  ok: false;
  safeFallbackUsed: true;
  data: Record<string, unknown>;
}

export const FALLBACKS: Record<Doc12TriggerType, Doc13FallbackResult> = {
  GOAL_STRUCTURING: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      cleaned_goal: "Goal requires clarification before structuring can continue",
      measurable_outcome: "Clarify the measurable outcome with the user",
      missing_fields: ["goal"],
      goal_is_clear: false,
    },
  },
  TASK_DRAFTING: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      title: "Continue working on your next step",
      instruction: "Complete the next required action for your project.",
      expected_output: "Progress on your current task",
      definition_of_done: "You have made measurable progress on this task",
      why_it_matters: "Every step moves your project forward",
    },
  },
  BLOCKER_CLASSIFICATION: {
    ok: false,
    safeFallbackUsed: true,
    data: { category: "OTHER", confidence: "LOW", reasoning: "Classification unavailable" },
  },
  CLARIFICATION_PROMPT: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      question: "What specifically did you do or produce for this task?",
      missing_field: "output_description",
      why_needed: "More detail needed to validate this submission",
    },
  },
  STATE_EXPLANATION: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      headline: "Here is your next step",
      explanation: "Your project is active. Complete your current task to continue.",
      what_is_allowed: ["Complete current task", "Submit progress update"],
      what_is_restricted: [],
      recommended_next_action: "Work on your current task and submit an update",
    },
  },
  RECOVERY_COPY: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      title: "Welcome back",
      welcome_back_message: "Good to have you back. Here is where you left off.",
      first_step_description: "Complete one small task to restart your momentum.",
      tone: "CALM",
    },
  },
  ROOT_CAUSE_ASSIST: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      candidates: [{ category: "CLARITY_FAILURE", likelihood: "MEDIUM", evidence: [] }],
    },
  },
  OUTCOME_EVIDENCE_SUMMARY: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      summary: "Evidence received. Additional proof may be needed.",
      evidence_strength_label: "WEAK",
      missing_evidence_description: "Submit specific output or confirmation",
    },
  },
  PROOF_RELEVANCE_CHECK: {
    ok: false,
    safeFallbackUsed: true,
    data: { is_relevant: true, relevance_score: 50, explanation: "Could not determine relevance" },
  },
  ACADEMY_SUPPORT: {
    ok: false,
    safeFallbackUsed: true,
    data: {
      title: "Build this capability",
      explanation: "This skill is required for your next task. Practice it with the steps below.",
      execution_requirement: "Complete a task that demonstrates this capability",
      proof_description: "Submit evidence that you applied this skill",
      learning_type: "CAPABILITY_ACTIVATION",
    },
  },
};

const BLOCKER_CATEGORY_MAP: Record<string, string> = {
  DEPENDENCY_MISSING: "DEPENDENCY_BLOCKED",
  EXTERNAL_WAIT: "EXTERNAL_WAIT",
  CLARITY_NEEDED: "UNCLEAR_TASK",
  CAPABILITY_GAP: "TOO_DIFFICULT",
  RESOURCE_MISSING: "OTHER",
  OTHER: "OTHER",
};

const ROOT_CAUSE_CATEGORY_MAP: Record<string, string> = {
  CLARITY_FAILURE: "CLARITY",
  CAPABILITY_FAILURE: "CAPABILITY",
  CAPACITY_FAILURE: "CAPACITY",
  DEPENDENCY_FAILURE: "DEPENDENCY",
  MOTIVATION_FRICTION: "MOTIVATION",
  SYSTEM_FRICTION: "SYSTEM_FRICTION",
  WRONG_PRIORITY: "CLARITY",
  OUTCOME_MISMATCH: "EXTERNAL",
  EXTERNAL_BLOCKER: "EXTERNAL",
  PROOF_FAILURE: "SYSTEM_FRICTION",
};

function toEnvelopeData(triggerType: Doc12TriggerType, data: Record<string, unknown>): Record<string, unknown> {
  switch (triggerType) {
    case "GOAL_STRUCTURING":
      return {
        cleanedGoal: data.cleaned_goal,
        purpose: data.measurable_outcome,
        timeframe: "",
        commitmentLevel: "MEDIUM",
        domainHints: [],
        ambiguityFlags: [],
        missingRequiredFields: data.missing_fields ?? [],
      };
    case "TASK_DRAFTING":
      return {
        title: data.title,
        instruction: data.instruction,
        requiredOutput: data.expected_output,
        doneCriteria: data.definition_of_done,
        userFacingReason: data.why_it_matters,
        proofInstruction: data.proof_description ?? "Describe what you completed.",
        successCriteria: [String(data.definition_of_done ?? "Task completed")],
        estimatedEffortLabel: "MEDIUM",
      };
    case "BLOCKER_CLASSIFICATION":
      return {
        blockerCategory: BLOCKER_CATEGORY_MAP[String(data.category)] ?? "OTHER",
        severity: data.confidence ?? "LOW",
        needsDependencyResolution: data.category === "DEPENDENCY_MISSING",
        needsRecoveryTask: true,
        summary: data.reasoning ?? "Classification unavailable",
      };
    case "CLARIFICATION_PROMPT":
      return {
        question: data.question,
        requiredField: data.missing_field,
        answerType: "TEXT",
        choices: [],
        whyNeeded: data.why_needed,
      };
    case "STATE_EXPLANATION":
      return {
        headline: data.headline,
        explanation: data.explanation,
        nextActionReason: data.recommended_next_action,
        displayTone: "CALM",
      };
    case "RECOVERY_COPY":
      return {
        title: data.title,
        instruction: data.first_step_description,
        expectedOutput: data.first_step_description,
        tone: data.tone === "ENCOURAGING" ? "WARM" : data.tone === "NEUTRAL" ? "DIRECT" : "CALM",
      };
    case "ACADEMY_SUPPORT":
      return {
        title: data.title,
        explanation: data.explanation,
        executionRequirement: data.execution_requirement,
        proofDescription: data.proof_description,
        learningType: data.learning_type,
      };
    case "ROOT_CAUSE_ASSIST":
      return {
        candidates: (
          (data.candidates as Array<{ category: string; likelihood: string; evidence: string[] }>) ?? []
        ).map((c) => ({
          category: ROOT_CAUSE_CATEGORY_MAP[c.category] ?? "CLARITY",
          likelihood: c.likelihood,
          evidence: c.evidence ?? [],
        })),
        recommendedNextDiagnosticQuestion:
          data.recommended_diagnostic_question ?? "What blocked progress on this task?",
      };
    case "OUTCOME_EVIDENCE_SUMMARY":
      return {
        submittedEvidenceSummary: data.summary,
        validationRecommendation:
          data.evidence_strength_label === "STRONG" ? "ENOUGH_TO_REVIEW" : "NEEDS_MORE_EVIDENCE",
        missingEvidenceNotes: data.missing_evidence_description,
      };
    case "PROOF_RELEVANCE_CHECK":
      return {
        relevant: data.is_relevant,
        confidence:
          Number(data.relevance_score) >= 70 ? "HIGH" : Number(data.relevance_score) >= 40 ? "MEDIUM" : "LOW",
        reason: data.explanation,
      };
    default:
      return data;
  }
}

export function getDoc13Fallback(triggerType: Doc12TriggerType): Doc13FallbackResult {
  return FALLBACKS[triggerType];
}

export function getDoc13FallbackEnvelope(
  triggerType: Doc12TriggerType,
  stateVersion: number,
  ctx: Record<string, unknown> = {},
): BhudhiOutputEnvelope {
  const fallback = FALLBACKS[triggerType];
  const outputType = REGISTERED_TRIGGERS[triggerType].outputType as BhudhiOutputType;
  const data = toEnvelopeData(triggerType, {
    ...fallback.data,
    ...(ctx.raw_goal ? { cleaned_goal: String(ctx.raw_goal) } : {}),
    ...(ctx.rawGoal ? { cleaned_goal: String(ctx.rawGoal) } : {}),
  });

  return {
    outputType,
    contractVersion: "1.0",
    stateVersion,
    confidence: "LOW",
    data,
    missingFields: Array.isArray(fallback.data.missing_fields) ? (fallback.data.missing_fields as string[]) : [],
    warnings: ["DOC13 deterministic fallback used"],
    forbiddenActionRequested: false,
  };
}

export function validateAllFallbacksAgainstSchemas(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [trigger, fallback] of Object.entries(FALLBACKS) as [Doc12TriggerType, Doc13FallbackResult][]) {
    const schema = OUTPUT_SCHEMAS[trigger];
    const result = schema.safeParse(fallback.data);
    if (!result.success) {
      errors.push(`${trigger}: ${result.error.issues.map((i) => i.message).join("; ")}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export const FallbackLibrary = {
  fallbacks: FALLBACKS,
  get: getDoc13Fallback,
  getEnvelope: getDoc13FallbackEnvelope,
  validateAll: validateAllFallbacksAgainstSchemas,
};
