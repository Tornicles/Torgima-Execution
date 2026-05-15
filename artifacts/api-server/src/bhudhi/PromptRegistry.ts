import type { BhudhiTriggerType, BhudhiMode, BhudhiOutputType } from "../types/bhudhi.js";

export interface PromptContract {
  name:            string;
  version:         string;
  triggerType:     BhudhiTriggerType;
  mode:            BhudhiMode;
  outputType:      BhudhiOutputType;
  maxTokens:       number;
  temperature:     number;
  systemPrompt:    string;
  buildUserPrompt: (ctx: Record<string, unknown>) => string;
  fallbackKey:     string;
  memoryAllowed:   boolean;
}

const STANDARD_SYSTEM_HEADER = `You are Bhudhi inside Torgima — a controlled execution intelligence system.
You are NOT a chatbot. You are NOT the system authority.
You interpret, structure, draft, and explain inside the provided constraints.
You must obey allowedActions and forbiddenActions in the context.
You must NOT change state, approve proof, override enforcement, decide conditions, calculate signals, create unauthorized tasks, or invent unavailable data.
Return ONLY the required JSON format. No markdown. No explanation outside JSON. No preamble.`;

const registry = new Map<BhudhiTriggerType, PromptContract>();

registry.set("GOAL_STRUCTURING", {
  name:         "goal.structure.v1",
  version:      "1.0",
  triggerType:  "GOAL_STRUCTURING",
  mode:         "STRUCTURE",
  outputType:   "structured_goal",
  maxTokens:    600,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.goal_structure",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Raw goal input: "${String(ctx["rawGoal"] ?? "")}"
Purpose: "${String(ctx["purpose"] ?? "not provided")}"
Timeframe: "${String(ctx["timeframe"] ?? "not provided")}"
Commitment: "${String(ctx["commitmentLevel"] ?? "not provided")}"
Context: "${String(ctx["currentContext"] ?? "not provided")}"
Success signal: "${String(ctx["successSignal"] ?? "not provided")}"
Known blockers: "${String(ctx["blockers"] ?? "not provided")}"

Return ONLY this JSON:
{
  "outputType": "structured_goal",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "cleanedGoal": "rewritten specific goal",
    "purpose": "extracted or inferred purpose",
    "timeframe": "extracted timeframe",
    "commitmentLevel": "LOW|MEDIUM|HIGH|INTENSE",
    "domainHints": ["genesis|market|delivery|continuity"],
    "ambiguityFlags": ["specific ambiguity"],
    "missingRequiredFields": ["goal|purpose|timeframe|commitment"]
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("REALITY_INTELLIGENCE", {
  name:         "reality.intelligence.v1",
  version:      "1.0",
  triggerType:  "REALITY_INTELLIGENCE",
  mode:         "STRUCTURE",
  outputType:   "reality_intelligence",
  maxTokens:    2500,
  temperature:  0.35,
  memoryAllowed: false,
  fallbackKey:  "fallback.reality_intelligence",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Analyze market and positioning context for this execution goal.

Goal: "${String(ctx["goal"] ?? "")}"
Domain: "${String(ctx["domain"] ?? "business")}"
Purpose: "${String(ctx["purpose"] ?? "")}"

Return ONLY JSON with this envelope (no markdown):
{
  "outputType": "reality_intelligence",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "marketMomentum": "growing|declining|emerging|oversaturated|behavior_shifting",
    "similarCompanies": [
      {"name": "Company X", "reason": "why similar", "outcome": "succeeded|failed|pivoted", "lesson": "what to learn"}
    ],
    "positioning": {
      "strongestAngle": "",
      "weakestAngle": "",
      "userMisconception": "",
      "differentiationOpportunity": ""
    },
    "whiteSpace": {
      "underservedUsers": [],
      "emotionalGaps": [],
      "executionGaps": [],
      "unclaimedPositioning": []
    },
    "strategicWarnings": [],
    "competitorWeaknesses": [],
    "blueprintSeedingInstructions": ""
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}
`,
});

registry.set("TASK_DRAFTING", {
  name:         "task.draft.v1",
  version:      "1.0",
  triggerType:  "TASK_DRAFTING",
  mode:         "DRAFT",
  outputType:   "task_copy",
  maxTokens:    500,
  temperature:  0.25,
  memoryAllowed: true,
  fallbackKey:  "fallback.task_copy",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Goal: "${String(ctx["goal"] ?? "")}"
Domain: ${String(ctx["domain"] ?? "delivery")}
Task type: ${String(ctx["taskType"] ?? "execution")}
Action context: "${String(ctx["actionContext"] ?? "next execution step")}"
Difficulty: ${String(ctx["difficulty"] ?? "moderate")}
Proof type: ${String(ctx["proofType"] ?? "none")}
Current condition: ${String(ctx["condition"] ?? "urgency")}
Allowed actions: ${JSON.stringify(ctx["allowedActions"] ?? [])}

Improve this task for the user. Return ONLY this JSON:
{
  "outputType": "task_copy",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "title": "specific action title (max 80 chars)",
    "instruction": "clear instruction tied to goal (max 400 chars)",
    "proofInstruction": "what to submit as proof (max 150 chars)",
    "successCriteria": ["1 to 3 specific criteria"],
    "estimatedEffortLabel": "SMALL|MEDIUM|LARGE",
    "userFacingReason": "why this matters for the goal (max 100 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("FEEDBACK_CLASSIFICATION", {
  name:         "feedback.classify_blocker.v1",
  version:      "1.0",
  triggerType:  "FEEDBACK_CLASSIFICATION",
  mode:         "INTERPRET",
  outputType:   "blocker_classification",
  maxTokens:    300,
  temperature:  0.1,
  memoryAllowed: true,
  fallbackKey:  "fallback.blocker_classification",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
User's blocker or friction description: "${String(ctx["userInput"] ?? "")}"
Task title: "${String(ctx["taskTitle"] ?? "unknown")}"
Task difficulty: ${String(ctx["difficulty"] ?? "moderate")}

Classify the blocker. Return ONLY this JSON:
{
  "outputType": "blocker_classification",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "blockerCategory": "MISSING_INFORMATION|DEPENDENCY_BLOCKED|TOO_DIFFICULT|TIME_CONSTRAINT|ENERGY_CONSTRAINT|EXTERNAL_WAIT|UNCLEAR_TASK|OTHER",
    "severity": "LOW|MEDIUM|HIGH",
    "needsDependencyResolution": false,
    "needsRecoveryTask": false,
    "summary": "one-sentence user-facing description (max 120 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("CLARIFICATION_PROMPT", {
  name:         "task.clarification.v1",
  version:      "1.0",
  triggerType:  "CLARIFICATION_PROMPT",
  mode:         "INTERPRET",
  outputType:   "clarification_request",
  maxTokens:    250,
  temperature:  0.1,
  memoryAllowed: false,
  fallbackKey:  "fallback.clarification",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Missing context for: "${String(ctx["missingContext"] ?? "unknown")}"
Required field: "${String(ctx["requiredField"] ?? "")}"
Current task: "${String(ctx["taskTitle"] ?? "unknown")}"

Ask ONE precise question to get the missing information. Return ONLY this JSON:
{
  "outputType": "clarification_request",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "question": "one precise question (max 120 chars)",
    "requiredField": "${String(ctx["requiredField"] ?? "context")}",
    "answerType": "TEXT|NUMBER|DATE|BOOLEAN|CHOICE",
    "choices": [],
    "whyNeeded": "user-facing reason (max 80 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("RECOVERY_COPY", {
  name:         "task.recovery.v1",
  version:      "1.0",
  triggerType:  "RECOVERY_COPY",
  mode:         "DRAFT",
  outputType:   "recovery_copy",
  maxTokens:    350,
  temperature:  0.3,
  memoryAllowed: true,
  fallbackKey:  "fallback.recovery_copy",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
User's goal: "${String(ctx["goal"] ?? "")}"
Days inactive: ${ctx["daysInactive"] ?? 0}
Previous condition: ${String(ctx["previousCondition"] ?? "urgency")}
Recovery context: "${String(ctx["recoveryContext"] ?? "returning to execution")}"

Write calm re-entry task wording. Return ONLY this JSON:
{
  "outputType": "recovery_copy",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "title": "calm recovery task title (max 60 chars)",
    "instruction": "low-friction restart instruction (max 300 chars)",
    "expectedOutput": "simple concrete output (max 100 chars)",
    "tone": "CALM|WARM|DIRECT"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("STATE_EXPLANATION", {
  name:         "state.explain.v1",
  version:      "1.0",
  triggerType:  "STATE_EXPLANATION",
  mode:         "EXPLAIN",
  outputType:   "state_explanation",
  maxTokens:    400,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.state_explanation",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Current condition: ${String(ctx["condition"] ?? "urgency")}
Condition duration: ${ctx["conditionDuration"] ?? 0} days
Completion rate: ${ctx["completionRate"] ?? 0}
Weighted score: ${ctx["weightedScore"] ?? 0}/10
Momentum: ${ctx["momentum"] ?? 0} days
Trend: ${String(ctx["trend"] ?? "stable")}
Current task: "${String(ctx["currentTaskTitle"] ?? "none")}"
Goal: "${String(ctx["goal"] ?? "unknown")}"

Explain the user's current state simply and directly. Return ONLY this JSON:
{
  "outputType": "state_explanation",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "headline": "short headline (max 60 chars)",
    "explanation": "plain language explanation (max 200 chars)",
    "nextActionReason": "why the next task matters now (max 120 chars)",
    "reassurance": "optional calm short message (max 80 chars)",
    "displayTone": "CALM|DIRECT|RECOVERY|FOCUSED"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("INACTIVITY_RESTART", {
  name:         "inactivity.restart.v1",
  version:      "1.0",
  triggerType:  "INACTIVITY_RESTART",
  mode:         "DRAFT",
  outputType:   "restart_copy",
  maxTokens:    300,
  temperature:  0.3,
  memoryAllowed: true,
  fallbackKey:  "fallback.recovery_copy",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Goal: "${String(ctx["goal"] ?? "")}"
Days since last activity: ${ctx["daysInactive"] ?? 0}
Previous best streak: ${ctx["bestStreak"] ?? 0} days

Write one sentence of warm, non-shaming re-entry guidance and a low-friction task. Return ONLY this JSON:
{
  "outputType": "restart_copy",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "title": "welcome back task title (max 60 chars)",
    "instruction": "low-friction restart (max 200 chars)",
    "welcomeMessage": "one warm sentence (max 100 chars, no shame, no pressure)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("ACADEMY_SUPPORT", {
  name:         "academy.instruction.v1",
  version:      "1.0",
  triggerType:  "ACADEMY_SUPPORT",
  mode:         "DRAFT",
  outputType:   "academy_instruction",
  maxTokens:    400,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.academy_instruction",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Capability gap: "${String(ctx["capabilityGap"] ?? "unknown")}"
Current capability level: ${String(ctx["capabilityLevel"] ?? "beginner")}
Task that exposed the gap: "${String(ctx["taskTitle"] ?? "unknown")}"
Goal: "${String(ctx["goal"] ?? "unknown")}"

Write an academy task for this gap. Return ONLY this JSON:
{
  "outputType": "academy_instruction",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "title": "Learn: [skill] (max 60 chars)",
    "instruction": "specific learning instruction (max 300 chars)",
    "practiceTask": "one practice exercise (max 150 chars)",
    "proofOfUnderstanding": "how to demonstrate learning (max 100 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("OUTCOME_EVIDENCE_SUMMARY", {
  name:         "outcome.evidence_summary.v1",
  version:      "1.0",
  triggerType:  "OUTCOME_EVIDENCE_SUMMARY",
  mode:         "INTERPRET",
  outputType:   "evidence_summary",
  maxTokens:    350,
  temperature:  0.1,
  memoryAllowed: false,
  fallbackKey:  "fallback.evidence_summary",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Claimed outcome: "${String(ctx["claimedOutcome"] ?? "")}"
Evidence submitted: "${String(ctx["evidenceText"] ?? "none")}"
Target metric: "${String(ctx["targetMetric"] ?? "unspecified")}"
Target value: ${String(ctx["targetValue"] ?? "unspecified")}

Summarize the evidence without making a final validation decision. Return ONLY this JSON:
{
  "outputType": "evidence_summary",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "submittedEvidenceSummary": "neutral summary (max 200 chars)",
    "evidenceTypesDetected": ["list of detected evidence types"],
    "missingEvidenceHints": ["what would strengthen the claim"],
    "contradictionsOrWeaknesses": ["specific issues if any"],
    "validationRecommendation": "ENOUGH_TO_REVIEW|NEEDS_MORE_EVIDENCE|UNCLEAR"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("ROOT_CAUSE_ASSIST", {
  name:         "failure.root_candidates.v1",
  version:      "1.0",
  triggerType:  "ROOT_CAUSE_ASSIST",
  mode:         "SUGGEST",
  outputType:   "root_cause_candidates",
  maxTokens:    400,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.root_cause",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Pattern description: "${String(ctx["patternDescription"] ?? "repeated failure")}"
Failure evidence: "${String(ctx["failureEvidence"] ?? "unknown")}"
Condition: ${String(ctx["condition"] ?? "urgency")}
Completion rate: ${ctx["completionRate"] ?? 0}

Suggest candidate root causes. Return ONLY this JSON:
{
  "outputType": "root_cause_candidates",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "candidates": [
      {
        "category": "CLARITY|CAPABILITY|CAPACITY|DEPENDENCY|MOTIVATION|SYSTEM_FRICTION|EXTERNAL",
        "likelihood": "LOW|MEDIUM|HIGH",
        "evidence": ["supporting observation"]
      }
    ],
    "recommendedNextDiagnosticQuestion": "one specific question to narrow the cause"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

export function getContract(triggerType: BhudhiTriggerType): PromptContract | null {
  return registry.get(triggerType) ?? null;
}

export function getAllContracts(): Map<BhudhiTriggerType, PromptContract> {
  return registry;
}
