/**
 * BHUDHI_SYSTEM_SPECIFICATION.md — interpretation intelligence layer.
 * Extracts meaning from goals, purposes, context, feedback, and patterns.
 */
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import type { feedback as feedbackTable } from "@workspace/db";
import {
  calculateFrameworkSignalsFromFeedback,
  calculateGrowth,
  calculateOperations,
  calculateProduction,
  calculateScale,
  signalConfidenceFromSampleCount,
} from "../signal/FrameworkSignalCalculationEngine.js";
import {
  generateGoalOptionsDeterministic,
  generatePurposeOptionsDeterministic,
  understandGoalDeterministic,
  understandPurposeDeterministic,
} from "../erector/ErectorRefinementEngine.js";
import type {
  BehaviorExtractionResult,
  ContextInterpretationResult,
  ContextRawInputs,
  FeedbackInterpretInput,
  FeedbackInterpretationResult,
  GoalInterpretationResult,
  PatternAnalysisResult,
  PurposeInterpretationResult,
} from "../../types/bhudhi-interpretation.js";

type FeedbackRow = typeof feedbackTable.$inferSelect;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function inferObjectType(raw: string): string {
  if (/app|platform|software|saas/i.test(raw)) return "mobile_application";
  if (/store|shop|ecommerce/i.test(raw)) return "commerce";
  if (/content|youtube|podcast/i.test(raw)) return "content";
  return "venture";
}

function inferObjectCategory(raw: string): string {
  if (/fitness|health|workout/i.test(raw)) return "health_wellness";
  if (/food|restaurant/i.test(raw)) return "food_hospitality";
  if (/education|course/i.test(raw)) return "education";
  if (/finance/i.test(raw)) return "finance";
  return "general_business";
}

function inferIntent(raw: string): { intent: string; confidence: number } {
  if (/business|revenue|monetiz|profit/i.test(raw)) {
    return { intent: "Build a sustainable business", confidence: 0.75 };
  }
  if (/help|solve|support/i.test(raw)) {
    return { intent: "Help users achieve a meaningful outcome", confidence: 0.7 };
  }
  if (/learn|skill|portfolio/i.test(raw)) {
    return { intent: "Develop skills and portfolio", confidence: 0.65 };
  }
  return { intent: "Unclear — user benefit or business path not specified", confidence: 0.4 };
}

function gapKeysFromGoal(raw: string): string[] {
  const gaps: string[] = [];
  if (!/user|customer|people|audience|who/i.test(raw)) gaps.push("target_user_undefined");
  if (!/subscription|revenue|monetiz|sell|price|business/i.test(raw)) gaps.push("business_model_undefined");
  if (!/african|country|region|city|global|local/i.test(raw)) gaps.push("geography_undefined");
  if (!/success|metric|goal|kpi|outcome/i.test(raw)) gaps.push("success_criteria_undefined");
  if (!/different|unique|only|first/i.test(raw)) gaps.push("differentiation_undefined");
  if (!/month|week|day|year|timeline|deadline/i.test(raw)) gaps.push("timeline_undefined");
  if (!/team|co-founder|partner|solo/i.test(raw)) gaps.push("team_undefined");
  return gaps;
}

async function enhanceWithBhudhi(
  triggerType: "ERECTOR_GOAL_REFINE" | "ERECTOR_PURPOSE_REFINE" | "FEEDBACK_CLASSIFICATION",
  facts: Record<string, unknown>,
  userId?: string,
  blueprintId?: string,
): Promise<Record<string, unknown> | null> {
  if (!userId || !blueprintId) return null;
  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "BHUDHI_INTERPRETATION",
      triggerType,
      userId,
      blueprintId,
      stateVersion: 0,
      idempotencyKey: `bhudhi_interp:${triggerType}:${Date.now()}`,
      facts,
    });
    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      return result.output.data as Record<string, unknown>;
    }
  } catch {
    /* deterministic only */
  }
  return null;
}

export async function interpretGoal(
  rawGoal: string,
  ctx?: { userId?: string; blueprintId?: string },
): Promise<GoalInterpretationResult> {
  const understanding = understandGoalDeterministic(rawGoal);
  const intentInfo = inferIntent(rawGoal);
  const gaps = gapKeysFromGoal(rawGoal);
  const ambiguity_level = Math.min(10, Math.max(1, gaps.length + (intentInfo.confidence < 0.5 ? 2 : 0)));

  const deterministicOptions = generateGoalOptionsDeterministic(rawGoal, understanding);
  const angles = ["simple", "targeted", "business"] as const;
  const refinement_options = deterministicOptions.map((option, i) => ({
    option,
    why:
      i === 0
        ? "Takes the core idea and clarifies the user benefit."
        : i === 1
          ? "Adds target market specificity."
          : "Includes business viability angle.",
    confidence: i === 0 ? 0.8 : 0.7,
    angle: angles[i],
  }));

  const ai = await enhanceWithBhudhi(
    "ERECTOR_GOAL_REFINE",
    { rawGoal, understanding, gaps },
    ctx?.userId,
    ctx?.blueprintId,
  );

  if (Array.isArray(ai?.refinement_options)) {
    const fromAi = ai.refinement_options as Array<{
      option?: string;
      why?: string;
      confidence?: number;
    }>;
    if (fromAi.length >= 3) {
      refinement_options.splice(
        0,
        refinement_options.length,
        ...fromAi.slice(0, 3).map((o, i) => ({
          option: String(o.option ?? deterministicOptions[i]),
          why: String(o.why ?? refinement_options[i]?.why ?? ""),
          confidence: Number(o.confidence ?? 0.7),
          angle: angles[i],
        })),
      );
    }
  }

  const objectSnippet = rawGoal.replace(/^i want to\s+/i, "").trim().slice(0, 80) || understanding.object;

  return {
    raw_goal: rawGoal,
    goal_extraction: {
      object: objectSnippet,
      outcome: understanding.impliedOutcome,
      intent: intentInfo.intent,
      domain: understanding.domain,
      objectType: inferObjectType(rawGoal),
      objectCategory: inferObjectCategory(rawGoal),
      primaryDomain: understanding.domain.split("/")[0]?.trim() ?? "General",
      secondaryDomain: "Technology",
      tertiaryDomain: "Business",
      outcomeSpecificity: clamp01(1 - ambiguity_level / 10),
      intentConfidence: intentInfo.confidence,
    },
    gaps: gaps.length ? gaps : understanding.unclear.map((u) => u.replace(/\s+/g, "_")),
    ambiguity_level,
    ready_for_refinement: true,
    refinement_options,
  };
}

export async function interpretPurpose(
  rawPurpose: string,
  ctx?: { goalContext?: string; userId?: string; blueprintId?: string },
): Promise<PurposeInterpretationResult> {
  const understanding = understandPurposeDeterministic(rawPurpose, ctx?.goalContext);
  const deterministicOptions = generatePurposeOptionsDeterministic(rawPurpose, understanding);
  const angles = ["problem", "transformation", "market"] as const;

  const refinement_options = deterministicOptions.map((option, i) => ({
    option,
    why:
      i === 0
        ? "Focuses on solving a specific problem."
        : i === 1
          ? "Focuses on user transformation."
          : "Focuses on market opportunity.",
    confidence: i === 2 ? 0.75 : 0.8,
    angle: angles[i],
  }));

  const clarity_scores = {
    problem: /access|lack|hard|difficult|problem/i.test(rawPurpose) ? 0.7 : 0.55,
    target_user: /african|diaspora|user|people|customer/i.test(rawPurpose) ? 0.65 : 0.5,
    change: /health|fit|habit|improve|transform/i.test(rawPurpose) ? 0.7 : 0.6,
    value: 0.65,
  };

  const ai = await enhanceWithBhudhi(
    "ERECTOR_PURPOSE_REFINE",
    { rawPurpose, goalContext: ctx?.goalContext, understanding },
    ctx?.userId,
    ctx?.blueprintId,
  );

  if (Array.isArray(ai?.refinement_options)) {
    const fromAi = ai.refinement_options as Array<{ option?: string; why?: string; confidence?: number }>;
    if (fromAi.length >= 3) {
      refinement_options.splice(
        0,
        refinement_options.length,
        ...fromAi.slice(0, 3).map((o, i) => ({
          option: String(o.option ?? deterministicOptions[i]),
          why: String(o.why ?? refinement_options[i]?.why ?? ""),
          confidence: Number(o.confidence ?? 0.75),
          angle: angles[i],
        })),
      );
    }
  }

  const valueList = [
    "Health improvement",
    "Confidence building",
    "Community belonging",
    "Cultural relevance",
  ].filter((_, i) => i < 2 || /community|culture|relevant/i.test(rawPurpose));

  return {
    raw_purpose: rawPurpose,
    purpose_extraction: {
      problem: understanding.problem,
      target_user: understanding.targetUser,
      change: understanding.change,
      value: valueList,
    },
    clarity_scores,
    who_benefits: [understanding.targetUser, "Fitness enthusiasts", "Health-conscious users"],
    pain_points_addressed: [
      "lack_of_guidance",
      "inconsistent_habits",
      "no_accountability",
      "cultural_misalignment",
    ],
    ready_for_refinement: true,
    refinement_options,
  };
}

export function interpretContext(rawInputs: ContextRawInputs): ContextInterpretationResult {
  const commitment = String(rawInputs.commitment ?? "part-time").toLowerCase();
  const people = Number(rawInputs.people ?? 1);
  const isSolo = people <= 1;
  const isPartTime = /part|side|evening/i.test(commitment);

  let hoursPerWeek = 40;
  if (isPartTime) hoursPerWeek = 20;
  if (/low|minimal/i.test(commitment)) hoursPerWeek = 10;

  const timeframe = String(rawInputs.timeframe ?? "90 days");
  const daysMatch = timeframe.match(/(\d+)\s*day/i);
  const monthsMatch = timeframe.match(/(\d+)\s*month/i);
  const totalDays = daysMatch
    ? Number(daysMatch[1])
    : monthsMatch
      ? Number(monthsMatch[1]) * 30
      : 90;
  const totalHours = Math.round((hoursPerWeek / 7) * totalDays);

  const limits = Array.isArray(rawInputs.limits) ? rawInputs.limits : [];
  const noFunding = limits.some((l) => /no.*fund|bootstrap|self/i.test(String(l)));
  const soloLimit = limits.some((l) => /solo|alone|one person/i.test(String(l)));

  const constraint_severity = {
    time: clamp01(totalDays < 60 ? 0.85 : totalDays < 120 ? 0.7 : 0.5),
    money: clamp01(/3000|low|tight|small/i.test(String(rawInputs.budget ?? "")) ? 0.65 : 0.45),
    team: isSolo || soloLimit ? 0.9 : 0.4,
    external_resources: noFunding ? 0.75 : 0.45,
  };

  const pressure =
    (constraint_severity.time + constraint_severity.team + constraint_severity.money) / 3;

  const execution_reality =
    pressure > 0.75
      ? "Tight timeline, solo founder, part-time capacity, limited budget — MVP-first required"
      : pressure > 0.55
        ? "Moderate constraints — prioritize focus and validate before scaling"
        : "Reasonable capacity — balanced execution pace";

  return {
    raw_inputs: rawInputs,
    extracted_execution_pressure: clamp01(pressure),
    extracted_capability_expectation: isSolo
      ? isPartTime
        ? "solo_founder_part_time"
        : "solo_founder_full_time"
      : "small_team",
    workload_model: {
      hours_available_per_week: hoursPerWeek,
      total_hours_available: totalHours,
      hours_per_day: Math.round((hoursPerWeek / 5) * 10) / 10,
      days_working: 5,
    },
    constraint_severity,
    execution_reality,
    execution_confidence: clamp01(1 - pressure * 0.4),
  };
}

function completionToScore(status: string, score: number): number {
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "completed") return 1;
  if (s === "PARTIAL" || s === "partial") return clamp01(score / 10);
  if (s === "FAILED" || s === "failed") return 0.2;
  if (s === "SKIPPED" || s === "skipped") return 0;
  return clamp01(score / 10);
}

function classifyBlocker(blocker?: string): { type: string; severity: number } {
  if (!blocker?.trim()) return { type: "none", severity: 0 };
  const b = blocker.toLowerCase();
  if (/complex|underestimat|technical|auth|integrat/i.test(b)) {
    return { type: "technical_complexity_underestimation", severity: 0.6 };
  }
  if (/time|schedule|deadline|late/i.test(b)) return { type: "time_estimation", severity: 0.55 };
  if (/knowledge|learn|unclear|confus/i.test(b)) return { type: "missing_knowledge", severity: 0.5 };
  return { type: "execution_friction", severity: 0.45 };
}

export async function interpretFeedback(
  input: FeedbackInterpretInput,
  ctx?: { userId?: string; blueprintId?: string },
): Promise<FeedbackInterpretationResult> {
  const completion_status = input.completed;
  const completion_score = completionToScore(input.completed, input.score);
  const performance_score = clamp01(input.score / 10);
  const blockerInfo = classifyBlocker(input.blocker);
  const blocker_detected = Boolean(input.blocker?.trim()) || blockerInfo.type !== "none";

  const insights: string[] = [];
  if (input.reflection?.toLowerCase().includes("longer") || input.reflection?.toLowerCase().includes("slow")) {
    insights.push("Execution velocity slower than estimated — Operations may need buffer time");
  }
  if (blocker_detected) {
    insights.push(`Blocker: ${input.blocker ?? blockerInfo.type} — adjust scope or timeline`);
  }
  if (performance_score < 0.5) {
    insights.push("Performance below expected — consider recovery tasks");
  }

  const feedback_confidence = clamp01(input.confidence ?? 0.7);
  const feedback_quality =
    feedback_confidence >= 0.75 && (input.reflection?.length ?? 0) > 20
      ? "high"
      : feedback_confidence >= 0.5
        ? "medium"
        : "low";

  const triggers_regeneration =
    performance_score < 0.6 || blocker_detected || completion_score < 0.5;

  const ai = await enhanceWithBhudhi(
    "FEEDBACK_CLASSIFICATION",
    { ...input, completion_score, performance_score, blocker_detected },
    ctx?.userId,
    ctx?.blueprintId,
  );

  if (Array.isArray(ai?.insights)) {
    insights.push(...(ai.insights as string[]).slice(0, 3));
  }

  return {
    completion_status,
    completion_score,
    performance_score,
    blocker_analysis: {
      detected: blocker_detected,
      type: blockerInfo.type,
      severity: blockerInfo.severity,
      impact_areas: blocker_detected ? ["Operations", "Timeline"] : [],
    },
    insights: [...new Set(insights)].slice(0, 5),
    key_insight: insights[0],
    learning_extracted: blocker_detected
      ? "Add buffer time to technical tasks and validate estimates earlier"
      : undefined,
    triggers_regeneration,
    reason_for_regeneration: triggers_regeneration
      ? "Performance below expected or blocker identified"
      : undefined,
    feedback_quality,
    feedback_confidence,
  };
}

export function analyzePatternsFromFeedbackRows(rows: FeedbackRow[]): PatternAnalysisResult {
  const window = rows.slice(0, 10);
  const count = window.length;

  if (count === 0) {
    return {
      patterns: { completion: 0.5, quality: 0.5, velocity: 0.5, learning: 0.5, consistency: 0.5 },
      trend: "insufficient_data",
      momentum: 0,
      confidence_in_patterns: 0.3,
      ready_for_signals: false,
    };
  }

  const completion = calculateProduction(window);
  const quality = calculateOperations(window);
  const learning = calculateGrowth(window);
  const velocity = calculateScale(window);
  const bundle = calculateFrameworkSignalsFromFeedback(window);
  const avgMomentum =
    (bundle.signals.Production.momentum +
      bundle.signals.Operations.momentum +
      bundle.signals.Growth.momentum +
      bundle.signals.Scale.momentum) /
    4;

  let trend = "stable";
  if (avgMomentum > 0.03) trend = "improving";
  else if (avgMomentum < -0.03) trend = "stable_with_minor_decline";
  else if (avgMomentum < -0.08) trend = "declining";

  const consistency = clamp01(
    1 - Math.abs(bundle.signals.Production.value - bundle.signals.Scale.value),
  );

  return {
    patterns: {
      completion,
      quality,
      velocity,
      learning,
      consistency,
    },
    trend,
    momentum: Math.round(avgMomentum * 100) / 100,
    confidence_in_patterns: signalConfidenceFromSampleCount(count),
    ready_for_signals: count >= 3,
  };
}

export function extractBehaviorFromFeedbackRows(rows: FeedbackRow[]): BehaviorExtractionResult {
  const window = rows.slice(0, 50);
  const scores = window.map((f) => f.score ?? f.weighted_score ?? 5);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  const completed = window.filter((f) => f.completion_status === "completed").length;
  const blocked = window.filter(
    (f) => f.blocker_json && Object.keys(f.blocker_json as object).length > 0,
  ).length;
  const skipped = window.filter((f) => f.completion_status === "skipped").length;

  const completionRate = window.length ? completed / window.length : 0;
  const patterns = analyzePatternsFromFeedbackRows(window);

  return {
    execution_patterns: {
      completion_tendency:
        completionRate >= 0.7 ? "Usually completes tasks" : "Often partial or blocked",
      blocker_response:
        blocked > skipped ? "Hits obstacles — may need smaller scope" : "Generally pushes through",
      feedback_honesty: avgScore <= 6.5 ? "Conservative scoring" : "Balanced self-assessment",
    },
    consistency: patterns.patterns.consistency,
    grit_indicators: clamp01(completionRate * 0.6 + patterns.patterns.learning * 0.4),
    discipline_indicators: clamp01(patterns.patterns.velocity),
    learning_velocity: patterns.patterns.learning,
    decision_patterns: {
      risk_aversion: clamp01(blocked / Math.max(1, window.length) + 0.3),
      overthinking: clamp01(
        window.filter((f) => (f.reflection?.length ?? 0) > 200).length / Math.max(1, window.length),
      ),
      action_speed: clamp01(completionRate),
    },
    capabilities_discovered: [
      completionRate >= 0.6 ? "Task completion" : "Persistence under friction",
      patterns.patterns.quality >= 0.6 ? "Quality execution" : "Problem analysis",
      "Self-reflection",
    ],
    growth_areas: [
      completionRate < 0.7 ? "Speed of execution" : "Scope management",
      blocked > 2 ? "Handling blockers" : "Maintaining momentum",
      patterns.patterns.velocity < 0.6 ? "Consistency" : "Strategic expansion",
    ],
  };
}
