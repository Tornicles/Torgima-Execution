import { db, blueprints, orders, feedback } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";

export interface BhudhiMemorySystem {
  userPatterns: {
    preferredWorkStyle: "morning" | "evening" | "weekend" | "inconsistent";
    averageTaskDuration: number;
    blockerFrequency: "rare" | "occasional" | "frequent";
    feedbackQualityTrend: "improving" | "stable" | "declining";
    domainStrengths: string[];
    domainWeaknesses: string[];
    lastKnownCapabilityLevel: string;
  };
  blueprintContext: {
    goalEssence: string;
    purposeCore: string;
    currentPlanName: string;
    currentPhaseName: string;
    keyMilestones: string[];
    completedMilestones: string[];
    knownBlockers: string[];
    successSignals: string[];
  };
  recentExecution: {
    recentTaskTypes: string[];
    recentDifficulties: string[];
    recentScores: number[];
    blockerTypes: string[];
    reflectionThemes: string[];
    momentumDays: number;
  };
}

function truncate(s: string | null | undefined, max = 120): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export async function loadBhudhiMemory(
  userId: string,
  blueprintId: string,
): Promise<BhudhiMemorySystem> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentOrders = await db
    .select({
      taskType: orders.task_type,
      difficulty: orders.difficulty,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(eq(orders.blueprint_id, blueprintId), gte(orders.updated_at, weekAgo)),
    )
    .orderBy(desc(orders.updated_at))
    .limit(20);

  const recentFb = await db
    .select({ score: feedback.score, reflection: feedback.reflection })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), gte(feedback.created_at, weekAgo)))
    .orderBy(desc(feedback.created_at))
    .limit(15);

  const scores = recentFb.map((f) => f.score).filter((s): s is number => typeof s === "number");
  const blockerCount = recentFb.filter((f) =>
    (f.reflection ?? "").toLowerCase().includes("block"),
  ).length;

  return {
    userPatterns: {
      preferredWorkStyle: "inconsistent",
      averageTaskDuration: 45,
      blockerFrequency:
        blockerCount >= 5 ? "frequent" : blockerCount >= 2 ? "occasional" : "rare",
      feedbackQualityTrend: "stable",
      domainStrengths: bp?.domain ? [bp.domain] : [],
      domainWeaknesses: [],
      lastKnownCapabilityLevel: bp?.commitment_level ?? "medium",
    },
    blueprintContext: {
      goalEssence: truncate(bp?.goal_final ?? bp?.goal),
      purposeCore: truncate(bp?.purpose_final ?? bp?.purpose),
      currentPlanName: "",
      currentPhaseName: "",
      keyMilestones: [],
      completedMilestones: [],
      knownBlockers: [],
      successSignals: bp?.success_signal ? [bp.success_signal] : [],
    },
    recentExecution: {
      recentTaskTypes: [...new Set(recentOrders.map((o) => o.taskType ?? "execution"))],
      recentDifficulties: [...new Set(recentOrders.map((o) => o.difficulty ?? "moderate"))],
      recentScores: scores,
      blockerTypes: blockerCount > 0 ? ["reflection_blocker"] : [],
      reflectionThemes: recentFb
        .map((f) => (f.reflection ?? "").split(/\s+/).slice(0, 3).join(" "))
        .filter(Boolean)
        .slice(0, 5),
      momentumDays: recentFb.length > 0 ? Math.min(7, recentFb.length) : 0,
    },
  };
}

export function buildMemoryContext(memory: BhudhiMemorySystem): string {
  return `
EXECUTION MEMORY (use to personalize output):
User work style: ${memory.userPatterns.preferredWorkStyle}
Current goal essence: ${memory.blueprintContext.goalEssence}
Current phase: ${memory.blueprintContext.currentPhaseName || "active execution"}
Recent momentum: ${memory.recentExecution.momentumDays} recent feedback events
Known strengths: ${memory.userPatterns.domainStrengths.join(", ") || "none recorded"}
Known weaknesses: ${memory.userPatterns.domainWeaknesses.join(", ") || "none recorded"}
Recent blocker patterns: ${memory.recentExecution.blockerTypes.join(", ") || "none"}
`.trim();
}

export async function buildMemoryContextForBlueprint(
  userId: string,
  blueprintId: string,
): Promise<string> {
  const memory = await loadBhudhiMemory(userId, blueprintId);
  return buildMemoryContext(memory);
}
