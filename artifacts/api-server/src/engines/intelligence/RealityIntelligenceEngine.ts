import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { RealityIntelligenceData } from "../../types/reality-intelligence.js";
import { trigger } from "../../bhudhi/BhudhiCore.js";

export type RealityIntelligence = RealityIntelligenceData;

function deterministicFallback(params: {
  goal: string;
  domain: string;
  purpose: string;
}): RealityIntelligence {
  void params.goal;
  void params.purpose;
  const domain = params.domain?.toLowerCase() ?? "business";
  return {
    marketMomentum: "growing",
    similarCompanies: [
      {
        name: "Early-stage competitor",
        reason: "Similar problem space",
        outcome: "succeeded",
        lesson: "Execution consistency was the differentiator",
      },
    ],
    positioning: {
      strongestAngle: `Direct execution focus in ${domain}`,
      weakestAngle: "Awareness and distribution",
      userMisconception: "Users may see this as another planning tool",
      differentiationOpportunity: "Real execution tracking — not just planning",
    },
    whiteSpace: {
      underservedUsers: ["Serious operators who need accountability"],
      emotionalGaps: ["Gap between intention and consistent execution"],
      executionGaps: ["No system that forces daily real-world action"],
      unclaimedPositioning: ["Execution OS for individual operators"],
    },
    strategicWarnings: ["Avoid feature creep", "Distribution is the hardest problem"],
    competitorWeaknesses: ["Most tools are planners, not executors", "Little real accountability"],
    blueprintSeedingInstructions:
      "Build phases around real-world execution milestones. Tasks must be specific operational commands, not generic suggestions.",
  };
}

export class RealityIntelligenceEngine {
  static async analyze(params: {
    goal: string;
    domain: string;
    purpose: string;
    blueprintId: string;
    userId: string;
  }): Promise<RealityIntelligence> {
    let stateVersion = 0;
    try {
      const [bp] = await db
        .select({ state_version: blueprints.state_version })
        .from(blueprints)
        .where(eq(blueprints.id, params.blueprintId))
        .limit(1);
      stateVersion = bp?.state_version ?? 0;
    } catch {
      stateVersion = 0;
    }

    try {
      const result = await trigger<RealityIntelligence>({
        sourceEngine: "RealityIntelligenceEngine",
        triggerType: "REALITY_INTELLIGENCE",
        userId: params.userId,
        blueprintId: params.blueprintId,
        stateVersion,
        idempotencyKey: `reality_intel:${params.blueprintId}:${Date.now()}`,
        facts: {
          goal: params.goal,
          domain: params.domain,
          purpose: params.purpose,
        },
      });

      const data = result.output?.data;
      if (result.ok && data && typeof data === "object" && "marketMomentum" in data) {
        return data as RealityIntelligence;
      }
    } catch {
      // fall through
    }

    return deterministicFallback(params);
  }
}
