import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { routeBhudhiRequest } from "./TriggerRouter.js";
import { retrieveMemory } from "./MemoryService.js";
import { getFallback } from "./FallbackLibrary.js";
import type { EISIntelligence } from "../engines/validation/intelligence/validation-intelligence-types.js";
import type { BhudhiTriggerResult } from "../types/bhudhi.js";

/** B4 — EIS fields stored on validation intelligence_payload (advisory only). */
export function buildEisExecutionFields(eis: EISIntelligence): {
  eis_demand_score: number;
  eis_saturation_score: number;
  eis_industry_context: string;
} {
  const demandMap = { weak: 35, moderate: 58, strong: 78, proven: 85 } as const;
  const satMap = { low: 25, medium: 50, high: 72, critical: 92 } as const;

  const demandScore = demandMap[eis.demand_signal.strength] ?? 50;
  const saturationScore = satMap[eis.saturation_level] ?? 50;
  const industryContext = [
    eis.industry,
    eis.niche,
    eis.demand_signal.evidence[0] ?? eis.macro_trends[0]?.summary,
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);

  return {
    eis_demand_score: demandScore,
    eis_saturation_score: saturationScore,
    eis_industry_context: industryContext,
  };
}

export interface DashboardIntelligenceBlock {
  headline: string;
  bodyText: string | null;
  nextActionSuggestion: string | null;
  fallbackUsed: boolean;
}

export async function fetchDashboardIntelligence(params: {
  userId: string;
  blueprintId: string;
  stateVersion: number;
  condition: string;
  completionRate: number;
  momentum: number;
  trend: string;
  goal: string;
  activeOrderTitle?: string;
  conditionDuration?: number;
}): Promise<DashboardIntelligenceBlock> {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const fallbackBlock = (usedFallback: boolean): DashboardIntelligenceBlock => {
    const fb = getFallback("fallback.state_explanation", {
      condition: params.condition,
      goal: params.goal,
      completionRate: params.completionRate,
      momentum: params.momentum,
      trend: params.trend,
      currentTaskTitle: params.activeOrderTitle,
    }, params.stateVersion);
    const d = (fb.data ?? {}) as Record<string, unknown>;
    return {
      headline: String(d.headline ?? "Execution active."),
      bodyText: String(d.explanation ?? null) || null,
      nextActionSuggestion: String(d.nextActionReason ?? null) || null,
      fallbackUsed: usedFallback,
    };
  };

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1)
    .catch(() => [{ enabled: false }]);

  if (!aiFlag?.enabled) {
    return fallbackBlock(true);
  }

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "DASHBOARD",
      triggerType: "STATE_EXPLANATION",
      requestedMode: "EXPLAIN",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: params.stateVersion,
      idempotencyKey: `dashboard:${params.blueprintId}:${minuteBucket}`,
      facts: {
        condition: params.condition,
        conditionDuration: params.conditionDuration ?? 0,
        completionRate: params.completionRate,
        weightedScore: params.completionRate * 10,
        momentum: params.momentum,
        trend: params.trend,
        goal: params.goal,
        currentTaskTitle: params.activeOrderTitle ?? "none",
      },
    });

    if (!result.ok || !result.output?.data) {
      return fallbackBlock(true);
    }

    const d = result.output.data as Record<string, unknown>;
    return {
      headline: String(d.headline ?? "Execution active."),
      bodyText: (d.explanation as string) ?? null,
      nextActionSuggestion: (d.nextActionReason as string) ?? null,
      fallbackUsed: result.fallbackUsed,
    };
  } catch {
    return fallbackBlock(true);
  }
}

export interface FeedbackCriticResult {
  interrogationQuestion?: string;
  requiresInterrogation: boolean;
  gamingSignal: boolean;
  fallbackUsed: boolean;
}

/** Critic mode — high score with brief reflection (B4). */
export async function runFeedbackCriticCheck(params: {
  userId: string;
  blueprintId: string;
  feedbackId: string;
  score: number;
  reflection: string;
  stateVersion: number;
}): Promise<FeedbackCriticResult> {
  const briefReflection = params.reflection.trim().length < 60;
  const highScore = params.score >= 8;

  if (!briefReflection || !highScore) {
    return { requiresInterrogation: false, gamingSignal: false, fallbackUsed: false };
  }

  const deterministicQuestion =
    "Your score was high but your reflection was brief. What specifically did you produce?";

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1)
    .catch(() => [{ enabled: false }]);

  if (!aiFlag?.enabled) {
    return {
      requiresInterrogation: true,
      interrogationQuestion: deterministicQuestion,
      gamingSignal: true,
      fallbackUsed: true,
    };
  }

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "FEEDBACK_PROCESSING",
      triggerType: "FEEDBACK_CLASSIFICATION",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: params.stateVersion,
      idempotencyKey: `critic:${params.feedbackId}`,
      facts: {
        feedbackText: `Score: ${params.score}. Reflection: ${params.reflection}`,
        criticMode: true,
        stateVersion: params.stateVersion,
      },
    });

    const d = (result.output?.data ?? {}) as Record<string, unknown>;
    const category = String(d.blockerCategory ?? "").toUpperCase();
    const summary = String(d.summary ?? "").toLowerCase();
    const gamingSignal =
      category === "GAMING_SIGNAL" ||
      summary.includes("gaming") ||
      summary.includes("brief reflection");

    if (gamingSignal) {
      return {
        requiresInterrogation: true,
        interrogationQuestion: deterministicQuestion,
        gamingSignal: true,
        fallbackUsed: result.fallbackUsed,
      };
    }

    return { requiresInterrogation: false, gamingSignal: false, fallbackUsed: result.fallbackUsed };
  } catch {
    return {
      requiresInterrogation: true,
      interrogationQuestion: deterministicQuestion,
      gamingSignal: true,
      fallbackUsed: true,
    };
  }
}

export interface RecoveryCopyResult {
  title: string;
  instruction: string;
  expectedOutput: string;
  usedBhudhi: boolean;
  fallbackUsed: boolean;
}

export async function fetchRecoveryCoachingCopy(params: {
  userId: string;
  blueprintId: string;
  stateVersion: number;
  goal: string;
  currentCondition: string;
  failureReason?: string;
  daysInactive?: number;
}): Promise<RecoveryCopyResult> {
  const template = {
    title: "Resume execution",
    instruction:
      params.failureReason?.trim()
        ? `Return with one small step. Last friction: ${params.failureReason.slice(0, 200)}. Complete it and submit honest feedback.`
        : `Choose one small concrete action toward: "${params.goal.slice(0, 120)}". Complete it and submit feedback.`,
    expectedOutput: "One completed action with feedback.",
    usedBhudhi: false,
    fallbackUsed: true,
  };

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1)
    .catch(() => [{ enabled: false }]);

  if (!aiFlag?.enabled) {
    return template;
  }

  let frictionPattern = "";
  try {
    frictionPattern = await retrieveMemory({
      userId: params.userId,
      blueprintId: params.blueprintId,
      triggerType: "RECOVERY_COPY",
    });
  } catch {
    frictionPattern = "";
  }

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "TASK_GENERATION",
      triggerType: "RECOVERY_COPY",
      requestedMode: "DRAFT",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: params.stateVersion,
      idempotencyKey: `recovery_copy:${params.blueprintId}:${Date.now()}`,
      facts: {
        goal: params.goal,
        daysInactive: params.daysInactive ?? 0,
        previousCondition: params.currentCondition,
        recoveryContext: params.failureReason ?? (frictionPattern || "returning to execution"),
        stateVersion: params.stateVersion,
      },
    });

    if (!result.ok || !result.output?.data) {
      return template;
    }

    const d = result.output.data as Record<string, unknown>;
    return {
      title: String(d.title ?? template.title).slice(0, 120),
      instruction: String(d.instruction ?? template.instruction).slice(0, 800),
      expectedOutput: String(d.expectedOutput ?? template.expectedOutput).slice(0, 300),
      usedBhudhi: !result.fallbackUsed,
      fallbackUsed: result.fallbackUsed,
    };
  } catch {
    return template;
  }
}

export type { BhudhiTriggerResult };
