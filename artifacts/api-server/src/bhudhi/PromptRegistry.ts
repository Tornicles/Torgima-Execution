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
  name:         "REALITY_INTELLIGENCE_ANALYSIS",
  version:      "2.0",
  triggerType:  "REALITY_INTELLIGENCE",
  mode:         "STRUCTURE",
  outputType:   "reality_intelligence",
  maxTokens:    2400,
  temperature:  0.28,
  memoryAllowed: true,
  fallbackKey:  "reality_intelligence_deterministic",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\n\nYou analyze market and positioning CONTEXT as strategic framing grounded ONLY in supplied inputs.` +
    ` You do not pretend to scrape the web.` +
    ` You do not authorize execution unlocks.` +
    ` You do not mutate signals or conditions.`,
  buildUserPrompt: (ctx) => `
Analyze this execution goal — return ONLY JSON in the mandated envelope shape (no markdown).

GOAL (rawGoal): "${String(ctx["rawGoal"] ?? ctx["goal"] ?? "")}"
PURPOSE: "${String(ctx["purpose"] ?? "")}"
DOMAIN: "${String(ctx["domain"] ?? "genesis")}"
TIMEFRAME: "${String(ctx["timeframe"] ?? "not provided")}"
COMMITMENT: "${String(ctx["commitmentLevel"] ?? "")}"
CONTEXT: "${String(ctx["currentContext"] ?? "Not provided")}"
SUCCESS SIGNAL HINT (non-authoritative context only): "${String(ctx["successSignal"] ?? "")}"
KNOWN BLOCKERS (context only): "${String(ctx["blockers"] ?? "")}"

Envelope:
{
  "outputType": "reality_intelligence",
  "contractVersion": "2.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "marketMomentum": "growing|declining|emerging|oversaturated|behavior_shifting",
    "demandConfidence": "high|medium|low",
    "trendExplanation": "Framed read using provided inputs — not claimed live telemetry",
    "similarConcepts": [
      {"name":"","reason":"","outcome":"succeeded|failed|pivoted","lesson":"","differentiationInsight":""}
    ],
    "positioning": {
      "strongestAngle": "",
      "weakestAngle": "",
      "userMisconception": "",
      "differentiationPath": "",
      "positioningRule": ""
    },
    "whiteSpace": {
      "underservedUsers": [],
      "emotionalGaps": [],
      "executionGaps": [],
      "competitorWeaknesses": [],
      "unclaimedPositioning": [],
      "opportunityPath": ""
    },
    "timingAnalysis": {
      "risk": "",
      "opportunity": "",
      "urgency": "immediate|moderate|patient",
      "reason": ""
    },
    "strategicWarnings": [],
    "blueprintSeedInstructions": "",
    "executionImplication": ""
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}
`,
});

registry.set("EIS_INDUSTRY_RESEARCH", {
  name:         "EIS_INDUSTRY_RESEARCH",
  version:      "1.0",
  triggerType:  "EIS_INDUSTRY_RESEARCH",
  mode:         "STRUCTURE",
  outputType:   "reality_intelligence",
  maxTokens:    2400,
  temperature:  0.28,
  memoryAllowed: true,
  fallbackKey:  "reality_intelligence_deterministic",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\n\nYou produce industry and market intelligence for validation (EIS).` +
    ` Ground analysis ONLY in supplied inputs — no claimed live scraping.`,
  buildUserPrompt: (ctx) => {
    const base = registry.get("REALITY_INTELLIGENCE");
    return base?.buildUserPrompt(ctx) ?? "";
  },
});

registry.set("DOMAIN_RESOLUTION", {
  name:         "domain.resolve.v1",
  version:      "1.0",
  triggerType:  "DOMAIN_RESOLUTION",
  mode:         "STRUCTURE",
  outputType:   "structured_goal",
  maxTokens:    1200,
  temperature:  0.25,
  memoryAllowed: true,
  fallbackKey:  "fallback.goal_structure",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\n\nResolve the user's goal into primary domain, industry, and niche for blueprint generation.` +
    ` Do not approve, launch, or mutate blueprint state.`,
  buildUserPrompt: (ctx) => {
    const goal = String(ctx["rawGoal"] ?? ctx["goal"] ?? "");
    const hint = String(ctx["domainHint"] ?? "");
    return `Goal: ${goal}\nDomain hint: ${hint || "none"}\nReturn structured_goal with cleanedGoal, primaryDomain, industryLabel, nicheLabel.`;
  },
});

registry.set("TASK_DRAFTING", {
  name:         "task.draft.v3",
  version:      "3.0",
  triggerType:  "TASK_DRAFTING",
  mode:         "DRAFT",
  outputType:   "task_copy",
  maxTokens:    900,
  temperature:  0.22,
  memoryAllowed: true,
  fallbackKey:  "fallback.task_copy",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\n\nDraft execution ORDER wording only.` +
    ` Do not bypass allowedActions / blocked_actions.` +
    ` Do not claim completion, unlock phases, change conditions, or modify signals.`,
  buildUserPrompt: (ctx) => {
    if (ctx["commandOrderMode"] === true) {
      return `
Operational command drafting (COMMAND mode). Facts are authoritative ceilings — obey them.

Blueprint goal: "${String(ctx["goal"] ?? "")}"
Domain: ${String(ctx["domain"] ?? "genesis")}
Task type: ${String(ctx["taskType"] ?? "execution")}
Action title (context): "${String(ctx["actionTitle"] ?? ctx["actionContext"] ?? "")}"
Project: "${String(ctx["projectTitle"] ?? "")}"
Phase: "${String(ctx["phaseTitle"] ?? "")}"
Plan: "${String(ctx["planTitle"] ?? "")}"
Difficulty: ${String(ctx["difficulty"] ?? "moderate")}
Minutes budget: ${String(ctx["timeEstimateMinutes"] ?? 45)}
Proof type: ${String(ctx["proofType"] ?? "none")}
Condition snapshot (reference only): ${String(ctx["condition"] ?? "")}
Condition tone (must reflect in copy): ${String(ctx["conditionTone"] ?? ctx["taskLanguageTone"] ?? "optimizing_forward")}
Behavioral profile: ${JSON.stringify(ctx["behavioralProfile"] ?? {})}
Knowledge package: ${JSON.stringify(ctx["knowledgePackage"] ?? null)}
Allowed actions: ${JSON.stringify(ctx["allowedActions"] ?? [])}
Strategic implication hint (reference only — not authoritative): "${String(ctx["intelligenceHint"] ?? "")}"

Return ONLY this JSON envelope:
{
  "outputType": "task_copy",
  "contractVersion": "2.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "title": "short title ≤80 chars aligned to actionTitle",
    "command": "imperative order text ≤900 chars — what to execute now under allowed actions",
    "requiredOutput": "what measurable artifact/output must exist",
    "proof": "how to prove completion (match proof type)",
    "doneCriteria": "definition of complete",
    "where": "primary environment/channel for this domain",
    "how": "most direct compliant method; if blocked, document blocker in feedback",
    "unlockConsequence": "neutral description of downstream progression coupling (do not invent unlock mechanics)",
    "userFacingReason": "why this order exists in strategic continuity",
    "successCriteria": ["1-3 bullets"],
    "estimatedEffortLabel": "SMALL|MEDIUM|LARGE",
    "proofInstruction": "align with proof requirement",
    "taskLanguageTone": "must match condition tone above",
    "knowledgeInjectionApplied": true | false,
    "aiPromptIfNeeded": null | "verbatim helper prompt OR null",
    "platformIfNeeded": null | "named platform focus OR null"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
    }
    return `
Goal: "${String(ctx["goal"] ?? "")}"
Domain: ${String(ctx["domain"] ?? "delivery")}
Task type: ${String(ctx["taskType"] ?? "execution")}
Action context: "${String(ctx["actionContext"] ?? "next execution step")}"
Difficulty: ${String(ctx["difficulty"] ?? "moderate")}
Proof type: ${String(ctx["proofType"] ?? "none")}
Current condition: ${String(ctx["condition"] ?? "urgency")}
Allowed actions: ${JSON.stringify(ctx["allowedActions"] ?? [])}

Improve this order copy for the user. Return ONLY this JSON:
{
  "outputType": "task_copy",
  "contractVersion": "2.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "title": "specific action title (max 80 chars)",
    "instruction": "clear instruction tied to goal (max 800 chars)",
    "proofInstruction": "what to submit as proof (max 200 chars)",
    "successCriteria": ["1 to 3 specific criteria"],
    "estimatedEffortLabel": "SMALL|MEDIUM|LARGE",
    "userFacingReason": "why this matters for the goal (max 160 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
  },
});

registry.set("FEEDBACK_CLASSIFICATION", {
  name:         "feedback.blocker.v1",
  version:      "1.0",
  triggerType:  "FEEDBACK_CLASSIFICATION",
  mode:         "INTERPRET",
  outputType:   "blocker_classification",
  maxTokens:    400,
  temperature:  0.15,
  memoryAllowed: true,
  fallbackKey:  "fallback.blocker_classification",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Classify execution blocker from user feedback. Return ONLY JSON:
{
  "outputType": "blocker_classification",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "blockerCategory": "DEPENDENCY|SKILL|MOTIVATION|CLARITY|RESOURCE|OTHER",
    "severity": "LOW|MEDIUM|HIGH",
    "needsDependencyResolution": false,
    "needsRecoveryTask": false,
    "summary": "short classification summary"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}
Feedback: "${String(ctx["feedbackText"] ?? ctx["summary"] ?? "")}"
Task: "${String(ctx["taskTitle"] ?? "")}"
`,
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
  fallbackKey:  "fallback.restart_copy",
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
  version:      "1.1",
  triggerType:  "ACADEMY_SUPPORT",
  mode:         "DRAFT",
  outputType:   "academy_instruction",
  maxTokens:    600,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.academy_instruction",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\nUse execution language: "Capability development", "execution skill", "apply this capability", "mastery evidence".` +
    ` FORBIDDEN in output: training, study, lesson, learning, quiz.`,
  buildUserPrompt: (ctx) => `
Skill category: "${String(ctx["skillCategory"] ?? ctx["capabilityGap"] ?? "unknown")}"
Practice type: ${String(ctx["practiceType"] ?? "PRACTICE")}
Current skill level: ${String(ctx["currentSkillLevel"] ?? ctx["capabilityLevel"] ?? 0.3)}
Lesson objective: "${String(ctx["lessonObjective"] ?? "close capability gap")}"
Goal: "${String(ctx["goal"] ?? "unknown")}"

Return ONLY this JSON:
{
  "outputType": "academy_instruction",
  "contractVersion": "1.1",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "title": "Capability: [skill] (max 80 chars)",
    "instruction": "max 600 chars",
    "expectedOutput": "max 300 chars",
    "masteryDefinition": "max 200 chars",
    "proofRequirement": "max 200 chars",
    "whyThisSkillMatters": "max 200 chars",
    "selfCheck": ["q1", "q2", "q3"],
    "practiceTask": "one practice exercise",
    "proofOfUnderstanding": "mastery evidence criteria"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("ACADEMY_SKILL_ASSESSMENT", {
  name:         "academy.skill_assessment.v1",
  version:      "1.0",
  triggerType:  "ACADEMY_SKILL_ASSESSMENT",
  mode:         "INTERPRET",
  outputType:   "academy_skill_assessment",
  maxTokens:    400,
  temperature:  0.1,
  memoryAllowed: true,
  fallbackKey:  "fallback.academy_skill_assessment",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    "\nAssess mastery evidence quality only — MasteryAssessmentEngine applies pass/fail rules.",
  buildUserPrompt: (ctx) => `
Skill category: "${String(ctx["skillCategory"] ?? "")}"
Mastery definition: "${String(ctx["masteryDefinition"] ?? "")}"
Submitted proof: "${String(ctx["proofText"] ?? "")}"
Completion score: ${String(ctx["completionScore"] ?? 0)}

Return ONLY this JSON:
{
  "outputType": "academy_skill_assessment",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "masteryScore": 0.0,
    "evidenceAnalysis": "max 300 chars",
    "masteredCriteria": ["criterion met"],
    "missingCriteria": ["criterion missing"]
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("ACADEMY_GAP_SEVERITY", {
  name:         "academy.gap_severity.v1",
  version:      "1.0",
  triggerType:  "ACADEMY_GAP_SEVERITY",
  mode:         "INTERPRET",
  outputType:   "academy_gap_severity",
  maxTokens:    350,
  temperature:  0.1,
  memoryAllowed: true,
  fallbackKey:  "fallback.academy_gap_severity",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    "\nAssess gap severity from evidence — CapabilityGapEngine applies deterministic thresholds.",
  buildUserPrompt: (ctx) => `
Failure details: "${String(ctx["failureDetails"] ?? "")}"
Failed task: "${String(ctx["taskInstruction"] ?? "")}"
Skill category: "${String(ctx["skillCategory"] ?? "")}"
Current skill score: ${String(ctx["currentSkillScore"] ?? 0.35)}

Return ONLY this JSON:
{
  "outputType": "academy_gap_severity",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "severity": "MEDIUM",
    "evidenceSummary": "max 200 chars",
    "recommendedLessons": 3,
    "fastestPathToResolution": "max 200 chars"
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

registry.set("BLUEPRINT_GENERATION", {
  name:         "blueprint.health_analysis.v1",
  version:      "1.0",
  triggerType:  "BLUEPRINT_GENERATION",
  mode:         "SUGGEST",
  outputType:   "blueprint_health",
  maxTokens:    800,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.blueprint_health",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Blueprint goal: "${String(ctx["goal"] ?? "")}"
Trigger: ${String(ctx["triggerReason"] ?? "HEALTH_CHECK")}
Gap count: ${ctx["gapCount"] ?? 0}
State version: ${ctx["stateVersion"] ?? 0}

Analyze blueprint health. Propose governance items only — never mutate structure directly.
Return ONLY JSON:
{
  "outputType": "blueprint_health",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "healthScore": 0.0,
    "gapsDetected": [],
    "proposalsGenerated": [],
    "agentAssessment": "max 500 chars",
    "confidenceTier": "MEDIUM"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("EXECUTION_SUPPORT", {
  name:         "task.execution_help.v1",
  version:      "1.0",
  triggerType:  "EXECUTION_SUPPORT",
  mode:         "EXPLAIN",
  outputType:   "execution_help",
  maxTokens:    500,
  temperature:  0.2,
  memoryAllowed: true,
  fallbackKey:  "fallback.execution_help",
  systemPrompt: STANDARD_SYSTEM_HEADER,
  buildUserPrompt: (ctx) => `
Active order title: "${String(ctx["orderTitle"] ?? "")}"
Instruction: "${String(ctx["instruction"] ?? "")}"
Domain: ${String(ctx["domain"] ?? "delivery")}

Return ONLY JSON:
{
  "outputType": "execution_help",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "steps": ["step 1 max 100 chars", "step 2", "step 3"],
    "toolList": ["tool 1", "tool 2"],
    "exampleOutput": "what good looks like",
    "tip": "one actionable tip"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("BLUEPRINT_INTERPRETATION", {
  name:         "blueprint.interpret.v1",
  version:      "1.0",
  triggerType:  "BLUEPRINT_INTERPRETATION",
  mode:         "EXPLAIN",
  outputType:   "blueprint_interpretation",
  maxTokens:    900,
  temperature:  0.25,
  memoryAllowed: true,
  fallbackKey:  "fallback.blueprint_interpretation",
  systemPrompt: STANDARD_SYSTEM_HEADER + `
Never use words: approve, mark complete, phase transition, override.`,
  buildUserPrompt: (ctx) => `
Goal: "${String(ctx["goal"] ?? "")}"
Purpose: "${String(ctx["purpose"] ?? "")}"
Condition: ${String(ctx["condition"] ?? "stability")}
Plans: ${ctx["planCount"] ?? 0}
State version: ${ctx["stateVersion"] ?? 0}

Return ONLY JSON:
{
  "outputType": "blueprint_interpretation",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "LOW|MEDIUM|HIGH",
  "data": {
    "interpretation": "max 800 chars plain language briefing",
    "keyInsights": ["insight 1", "insight 2"],
    "currentFocus": "max 200 chars",
    "nextMilestone": "max 200 chars",
    "riskFlags": []
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("BEHAVIORAL_ANALYSIS", {
  name:         "psychology.identity_update.v1",
  version:      "1.0",
  triggerType:  "BEHAVIORAL_ANALYSIS",
  mode:         "INTERPRET",
  outputType:   "identity_update",
  maxTokens:    600,
  temperature:  0.25,
  memoryAllowed: true,
  fallbackKey:  "fallback.psychology_identity",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\nForbidden words: congratulations, great job, amazing, proud. Use execution language only.`,
  buildUserPrompt: (ctx) => `
Recent reflections: ${JSON.stringify(ctx["recentReflections"] ?? [])}
Completion rate: ${ctx["completionRate"] ?? 0}
Character level: ${ctx["characterLevel"] ?? 1}
Reward type (if milestone): ${String(ctx["rewardType"] ?? "none")}
Evidence: ${String(ctx["evidenceSummary"] ?? "")}

Return ONLY JSON:
{
  "outputType": "identity_update",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "identityStage": "FORMING|DEVELOPING|ESTABLISHED|EVOLVING",
    "confidenceDelta": 0.05,
    "purposeAlignment": 0.5,
    "keyInsight": "max 200 chars",
    "milestoneProximity": false,
    "title": "max 60 chars if reward",
    "message": "max 200 chars execution-language milestone",
    "evidenceSummary": "what execution evidence earned this"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
});

registry.set("EIS_SYNTHESIS", {
  name:         "eis.synthesis.v1",
  version:      "1.0",
  triggerType:  "EIS_SYNTHESIS",
  mode:         "STRUCTURE",
  outputType:   "eis_synthesis",
  maxTokens:    1200,
  temperature:  0.28,
  memoryAllowed: true,
  fallbackKey:  "reality_intelligence_deterministic",
  systemPrompt:
    STANDARD_SYSTEM_HEADER +
    `\nSynthesize overnight EIS briefing from supplied search results only.` +
    ` Do not fabricate statistics or invent platform changes not present in search results.`,
  buildUserPrompt: (ctx) => `
Domain: ${String(ctx["domain"] ?? "")}
Niche: ${String(ctx["niche"] ?? "")}
Industry: ${String(ctx["industry"] ?? "")}
Blueprint phase: ${String(ctx["blueprintPhase"] ?? "execution")}
Current tasks: ${JSON.stringify(ctx["currentTasks"] ?? [])}
Search results: ${JSON.stringify(ctx["searchResults"] ?? [])}

Return ONLY JSON:
{
  "outputType": "eis_synthesis",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "trendingTopics": [{ "topic": "", "engagement": "", "platform": "", "relevance": 0.5, "insight": "" }],
    "platformSignals": [{ "platform": "", "signal": "", "recommendation": "" }],
    "opportunities": [{ "description": "", "timeWindow": "this_week", "relevanceScore": 0.5 }],
    "todayRecommendation": "one actionable step for today",
    "competitorInsights": ["insight"],
    "knowledgeUpdates": [{ "packagesToUpdate": [], "newSOP": "", "newBenchmark": "" }]
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
