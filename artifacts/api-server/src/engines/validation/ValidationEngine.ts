import { db } from "@workspace/db";
import {
  validations,
  blueprints,
  featureFlags,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import type {
  ValidationVerdict,
  ValidationScores,
  ValidationPath,
  ValidationResult,
  GoalDimension,
  StructuredGoalDraft,
} from "../../types/validation.js";

// ── AI FLAG HELPER ────────────────────────────────────────────────────────────

export async function isAiEnabled(): Promise<boolean> {
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);
  return rows[0]?.enabled ?? false;
}

// ── SCORE A GOAL ──────────────────────────────────────────────────────────────

export function scoreGoal(input: {
  goal: string;
  purpose?: string;
  timeframe?: string;
  commitmentLevel?: string;
  currentContext?: string;
  successSignal?: string;
  knownBlockers?: string;
}): ValidationScores {
  const clarity     = scoreClarity(input.goal, input.purpose);
  const feasibility = scoreFeasibility(input.goal, input.timeframe, input.commitmentLevel);
  const realism     = scoreRealism(input.goal, input.currentContext, input.knownBlockers);
  const usefulness  = scoreUsefulness(input.goal, input.purpose, input.successSignal);

  const overall = Math.round(
    clarity.score     * 0.30 +
    feasibility.score * 0.25 +
    realism.score     * 0.25 +
    usefulness.score  * 0.20,
  );

  return { clarity, feasibility, realism, usefulness, overall };
}

// ── DETERMINE VERDICT ────────────────────────────────────────────────────────

export function determineVerdict(scores: ValidationScores): ValidationVerdict {
  if (scores.clarity.verdict === "critical")    return "pivot";
  if (scores.usefulness.verdict === "critical") return "pivot";
  if (scores.overall < 35)                      return "pivot";

  if (
    scores.overall >= 70 &&
    scores.clarity.verdict !== "weak" &&
    scores.feasibility.verdict !== "critical" &&
    scores.realism.verdict !== "critical"
  ) {
    return "proceed";
  }

  return "adjust";
}

// ── GENERATE PATHS ───────────────────────────────────────────────────────────

export async function generatePaths(params: {
  goal:             string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  scores:           ValidationScores;
  verdict:          ValidationVerdict;
  blueprintId:      string;
  userId:           string;
  useBhudhi:        boolean;
}): Promise<{ current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath }> {
  if (params.useBhudhi) {
    try {
      return await generatePathsWithBhudhi(params);
    } catch (error) {
      logger.warn(
        { blueprintId: params.blueprintId, error: error instanceof Error ? error.message : String(error) },
        "[ValidationEngine] Bhudhi path generation failed — using deterministic fallback",
      );
    }
  }
  return generatePathsDeterministic(params);
}

// ── FULL VALIDATION RUN ───────────────────────────────────────────────────────

export async function runValidation(params: {
  blueprintId: string;
  userId:      string;
  input: {
    goal:             string;
    purpose?:         string;
    timeframe?:       string;
    commitmentLevel?: string;
    currentContext?:  string;
    successSignal?:   string;
    knownBlockers?:   string;
    domainHint?:      string | null;
  };
  aiEnabled: boolean;
  tier?: import("../blueprint/infrastructure/blueprint-types.js").BlueprintTier;
  mode?: string;
}): Promise<ValidationResult> {
  const { runFullValidation } = await import("./intelligence/ValidationOrchestrator.js");
  const full = await runFullValidation({
    blueprintId: params.blueprintId,
    userId: params.userId,
    input: params.input,
    aiEnabled: params.aiEnabled,
    tier: params.tier,
    mode: params.mode,
  });

  return {
    validationId: full.validationId,
    blueprintId: full.blueprintId,
    verdict: full.verdict,
    scores: full.scores,
    paths: full.paths,
    usedFallback: full.usedFallback,
    aiSummary: full.aiSummary,
    createdAt: full.createdAt,
    launchBlocked: full.launchBlocked,
    readiness: full.readiness,
    intelligence: full.intelligence as unknown as Record<string, unknown>,
    industryPanel: full.intelligence.industryPanel as unknown as Record<string, unknown>,
    tabs: full.intelligence.tabs as unknown as Record<string, unknown>,
    blueprintContract: full.blueprintContract as unknown as Record<string, unknown> | null,
    systemsProgress: full.intelligence.systemsProgress,
  };
}

// ── SCORING HELPERS ───────────────────────────────────────────────────────────

function scoreClarity(goal: string, purpose?: string): GoalDimension {
  let score = 50;
  const finding: string[] = [];

  const words = goal.trim().split(/\s+/);
  if (words.length < 5)  { score -= 30; finding.push("Goal is too short to be specific."); }
  if (words.length > 100){ score -= 10; finding.push("Goal may be too broad."); }

  const vagueTerms = ["something", "things", "better", "more", "good", "improve", "maybe", "possibly"];
  const vagueCount = vagueTerms.filter(t => goal.toLowerCase().includes(t)).length;
  score -= vagueCount * 10;
  if (vagueCount > 0) finding.push("Goal contains vague language that weakens execution.");

  const measurableSignals = [/\d+/, /percent|%/, /revenue|users|customers|sales/, /by\s+\w+\s+\d{4}/, /within\s+\d+/i];
  const measurable = measurableSignals.some(r => r.test(goal));
  if (measurable) score += 20;
  else finding.push("Goal lacks a measurable outcome or timeframe anchor.");

  if (purpose && purpose.trim().length > 10) score += 10;
  else finding.push("Purpose is missing or too brief.");

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    verdict: score >= 70 ? "strong" : score >= 50 ? "acceptable" : score >= 30 ? "weak" : "critical",
    finding: finding[0] ?? "Goal is clear and specific.",
    suggestion: score < 70 ? "Add a specific measurable outcome and timeframe." : undefined,
  };
}

function scoreFeasibility(goal: string, timeframe?: string, commitment?: string): GoalDimension {
  let score = 65;
  const finding: string[] = [];

  const overReachTerms = ["billion", "millions of", "world's largest", "fastest ever", "overnight", "instant"];
  if (overReachTerms.some(t => goal.toLowerCase().includes(t))) {
    score -= 25;
    finding.push("Goal scope may be unrealistic for a single execution cycle.");
  }

  if (!timeframe || timeframe.trim().length < 2) {
    score -= 15;
    finding.push("No timeframe defined. Execution without a timeframe lacks urgency.");
  }

  if (commitment === "low" || commitment === "medium") score -= 5;
  if (commitment === "high" || commitment === "full")  score += 10;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    verdict: score >= 70 ? "strong" : score >= 50 ? "acceptable" : score >= 30 ? "weak" : "critical",
    finding: finding[0] ?? "Goal appears feasible within normal execution parameters.",
    suggestion: score < 70 ? "Define a realistic timeframe and scope." : undefined,
  };
}

function scoreRealism(goal: string, context?: string, blockers?: string): GoalDimension {
  let score = 60;
  const finding: string[] = [];

  if (!context || context.trim().length < 10) {
    score -= 10;
    finding.push("Current context is missing. Execution without situational awareness risks misalignment.");
  } else {
    score += 15;
  }

  if (blockers && blockers.trim().length > 5) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    verdict: score >= 70 ? "strong" : score >= 50 ? "acceptable" : score >= 30 ? "weak" : "critical",
    finding: finding[0] ?? "Goal is grounded in current reality.",
    suggestion: score < 70 ? "Add your current context and known blockers." : undefined,
  };
}

function scoreUsefulness(goal: string, purpose?: string, successSignal?: string): GoalDimension {
  let score = 55;
  const finding: string[] = [];

  if (purpose && purpose.trim().length > 15) {
    score += 20;
  } else {
    finding.push("Purpose not clearly defined. Without purpose, execution loses direction over time.");
  }

  if (successSignal && successSignal.trim().length > 5) {
    score += 15;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    verdict: score >= 70 ? "strong" : score >= 50 ? "acceptable" : score >= 30 ? "weak" : "critical",
    finding: finding[0] ?? "Goal produces clear value.",
    suggestion: score < 70 ? "Define why this goal matters and what success looks like." : undefined,
  };
}

// ── PATH GENERATION — DETERMINISTIC ──────────────────────────────────────────
// Spec (Prompt 5): exported so callers can bypass Bhudhi entirely when AI is
// disabled or when a deterministic snapshot is required.

export function generatePathsDeterministic(params: {
  goal:             string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  scores:           ValidationScores;
  verdict:          ValidationVerdict;
}): { current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath } {
  const baseTarget = { name: `Primary outcome: ${params.goal.slice(0, 60)}`, type: "major" };

  const current: ValidationPath = {
    type:            "current",
    title:           "Continue with your stated goal",
    summary:         `Execute on your goal as defined: ${params.goal.slice(0, 120)}.`,
    rationale:       "This path takes your goal at face value and builds the execution structure directly from it.",
    expectedOutcome: "Validated progress on the stated goal within the defined timeframe.",
    riskLevel:       params.scores.overall < 50 ? "high" : params.scores.overall < 70 ? "medium" : "low",
    planSkeleton: {
      plans:   [
        { name: "Foundation", description: "Build base execution structure" },
        { name: "Validation", description: "Validate approach with real results" },
      ],
      targets: [baseTarget, { name: "Validation proof", type: "primary" }],
    },
  };

  const adjusted: ValidationPath = {
    type:            "adjusted",
    title:           "Refined version of your goal",
    summary:         "Same direction as your goal, with clearer scope and a more realistic execution path.",
    rationale:       "This path keeps your core intent but applies tighter scoping, measurability, and realistic timeframe.",
    expectedOutcome: "Clearer execution start with reduced risk of scope creep.",
    riskLevel:       "medium",
    keyChanges:      "Scope tightened. Measurable outcome added. Timeframe grounded in commitment level.",
    planSkeleton: {
      plans: [
        { name: "Foundation", description: "Clarify and ground execution" },
        { name: "Validation", description: "Prove approach works" },
        { name: "Growth", description: "Build on validated results" },
      ],
      targets: [
        { name: `Scoped: ${params.goal.slice(0, 50)}`, type: "major" },
        { name: "First proof of concept", type: "vital" },
      ],
    },
  };

  const alternative: ValidationPath = {
    type:            "alternative",
    title:           "Alternative direction worth considering",
    summary:         "A different execution angle that may reach the same outcome with lower initial risk.",
    rationale:       "This path reframes the approach to start smaller, validate faster, and build from a proven foundation.",
    expectedOutcome: "Lower risk entry with faster initial validation cycle.",
    riskLevel:       "low",
    keyChanges:      "Smaller first step. Earlier validation gate. Same long-term direction.",
    planSkeleton: {
      plans: [
        { name: "Minimum Viable Start", description: "Test the smallest version" },
        { name: "Foundation", description: "Build on what was validated" },
      ],
      targets: [
        { name: "Smallest viable proof", type: "vital" },
        { name: "Validated foundation", type: "primary" },
      ],
    },
  };

  return { current, adjusted, alternative };
}

/** Uses {@link trigger} GOAL_STRUCTURING (caps, logging, validation) then merges into deterministic paths. */
export async function generateValidationPathsWithBhudhi(params: {
  userId:            string;
  blueprintId:       string;
  goal:               string;
  purpose?:           string;
  timeframe?:         string;
  commitmentLevel?:   string;
  scores:             ValidationScores;
  verdict:            ValidationVerdict;
}): Promise<{ current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath }> {
  const deterministic = generatePathsDeterministic({
    goal:             params.goal,
    purpose:          params.purpose,
    timeframe:        params.timeframe,
    commitmentLevel:  params.commitmentLevel,
    scores:           params.scores,
    verdict:          params.verdict,
  });

  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const purposeAugmented = [
    params.purpose,
    `Execution validation — verdict: ${params.verdict}.`,
    `Scores — clarity ${params.scores.clarity.score}, feasibility ${params.scores.feasibility.score}, realism ${params.scores.realism.score}, usefulness ${params.scores.usefulness.score}, overall ${params.scores.overall}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const struct = await routeBhudhiRequest({
    sourceEngine:   "validation",
    triggerType:    "GOAL_STRUCTURING",
    userId:         params.userId,
    blueprintId:    params.blueprintId,
    stateVersion:   bp?.state_version ?? 0,
    idempotencyKey: `validation_paths:${params.blueprintId}:${Date.now()}`,
    facts: {
      rawGoal:         params.goal,
      purpose:         purposeAugmented,
      timeframe:       params.timeframe ?? "",
      commitmentLevel: params.commitmentLevel ?? "medium",
    },
  });

  if (!struct.ok || struct.fallbackUsed || !struct.output?.data) {
    return deterministic;
  }

  const d = struct.output.data as Record<string, unknown>;
  const cleaned = String(d["cleanedGoal"] ?? params.goal).trim() || params.goal;

  return generatePathsDeterministic({
    goal:             cleaned,
    purpose:          String(d["purpose"] ?? params.purpose ?? ""),
    timeframe:        String(d["timeframe"] ?? params.timeframe ?? ""),
    commitmentLevel:  String(d["commitmentLevel"] ?? params.commitmentLevel ?? "medium"),
    scores:           params.scores,
    verdict:          params.verdict,
  });
}

// ── PATH GENERATION — BHUDHI ──────────────────────────────────────────────────

async function generatePathsWithBhudhi(params: {
  goal:             string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  scores:           ValidationScores;
  verdict:          ValidationVerdict;
  blueprintId:      string;
  userId:           string;
}): Promise<{ current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath }> {
  return generateValidationPathsWithBhudhi({
    userId:          params.userId,
    blueprintId:     params.blueprintId,
    goal:            params.goal,
    purpose:         params.purpose,
    timeframe:       params.timeframe,
    commitmentLevel: params.commitmentLevel,
    scores:          params.scores,
    verdict:         params.verdict,
  });
}

// ── GOAL STRUCTURING — BHUDHI ─────────────────────────────────────────────────

export async function structureGoalWithBhudhi(raw: {
  rawGoal:          string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  currentContext?:  string;
  successSignal?:   string;
  knownBlockers?:   string;
  userId?:          string;
}): Promise<StructuredGoalDraft> {
  if (!raw.userId) {
    logger.warn("[ValidationEngine] structureGoalWithBhudhi without userId — using deterministic fallback");
    return structureGoalDeterministic(raw);
  }

  const result = await routeBhudhiRequest({
    sourceEngine:   "ValidationEngine",
    triggerType:    "GOAL_STRUCTURING",
    userId:         raw.userId,
    stateVersion:   0,
    idempotencyKey: `goal_structure:${Date.now()}`,
    facts: {
      rawGoal:         raw.rawGoal,
      purpose:         raw.purpose,
      timeframe:       raw.timeframe,
      commitmentLevel: raw.commitmentLevel,
      currentContext:  raw.currentContext,
      successSignal:   raw.successSignal,
      blockers:        raw.knownBlockers,
    },
  });

  if (!result.ok || !result.output) return structureGoalDeterministic(raw);

  const d = result.output.data as Record<string, unknown>;
  const rawCommit = String(d["commitmentLevel"] ?? raw.commitmentLevel ?? "medium").toLowerCase();
  const commitmentLevel: StructuredGoalDraft["commitmentLevel"] =
    rawCommit === "intense" || rawCommit === "full" ? "full" :
    rawCommit === "low" ? "low" :
    rawCommit === "high" ? "high" : "medium";

  const fromAi = (d["missingRequiredFields"] as string[] | undefined) ?? [];
  const deterministic = structureGoalDeterministic(raw);
  const missingRequiredFields = fromAi.length > 0 ? fromAi : deterministic.missingRequiredFields;

  return {
    cleanedGoal:          String(d["cleanedGoal"] ?? raw.rawGoal),
    purpose:              String(d["purpose"] ?? raw.purpose ?? ""),
    timeframe:            String(d["timeframe"] ?? raw.timeframe ?? ""),
    commitmentLevel,
    currentContext:       raw.currentContext ?? "",
    successSignals:       raw.successSignal ? [raw.successSignal] : [],
    blockers:             raw.knownBlockers ? [raw.knownBlockers] : [],
    domainHints:          (d["domainHints"] as string[]) ?? [],
    missingRequiredFields,
    ambiguityFlags:       (d["ambiguityFlags"] as string[]) ?? [],
    validationVerdict:    missingRequiredFields.length > 0 ? "NEEDS_CLARIFICATION" : "VALID",
  };
}

// ── GOAL STRUCTURING — DETERMINISTIC ─────────────────────────────────────────

export function structureGoalDeterministic(raw: {
  rawGoal:          string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  currentContext?:  string;
  successSignal?:   string;
  knownBlockers?:   string;
}): StructuredGoalDraft {
  const missing: string[] = [];
  if (!raw.rawGoal || raw.rawGoal.trim().length < 5) missing.push("goal");
  if (!raw.purpose || raw.purpose.trim().length < 5) missing.push("purpose");
  if (!raw.timeframe)                                 missing.push("timeframe");
  if (!raw.commitmentLevel)                           missing.push("commitment");

  const verdict: "VALID" | "NEEDS_CLARIFICATION" | "INVALID" =
    missing.includes("goal") ? "INVALID" :
    missing.length > 0       ? "NEEDS_CLARIFICATION" : "VALID";

  return {
    cleanedGoal:           raw.rawGoal.trim(),
    purpose:               raw.purpose ?? "",
    timeframe:             raw.timeframe ?? "",
    commitmentLevel:       (raw.commitmentLevel as "low" | "medium" | "high" | "full") ?? "medium",
    currentContext:        raw.currentContext ?? "",
    successSignals:        raw.successSignal ? [raw.successSignal] : [],
    blockers:              raw.knownBlockers ? [raw.knownBlockers] : [],
    domainHints:           [],
    missingRequiredFields: missing,
    ambiguityFlags:        [],
    validationVerdict:     verdict,
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function buildAiSummary(scores: ValidationScores, verdict: ValidationVerdict): string {
  const verdictText = {
    proceed: "Your goal is clear enough to execute. Launch the blueprint and begin.",
    adjust:  "Your goal has a good foundation but needs refinement before maximum execution speed.",
    pivot:   "The goal needs significant restructuring before a controlled execution blueprint can be built.",
  }[verdict];
  return `Overall score: ${scores.overall}/100. ${verdictText}`;
}

export function scoreToVerdict(score: number): "strong" | "acceptable" | "weak" | "critical" {
  if (score >= 70) return "strong";
  if (score >= 50) return "acceptable";
  if (score >= 30) return "weak";
  return "critical";
}
