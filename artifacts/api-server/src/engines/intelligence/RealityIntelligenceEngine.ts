import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  normalizeRealityIntelligenceData,
  type RealityIntelligenceData,
} from "../../types/reality-intelligence.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";

export type RealityIntelligence = RealityIntelligenceData;

function formatBlueprintTimeframe(row: {
  timeframe_start: Date | null;
  timeframe_end: Date | null;
}): string {
  const a = row.timeframe_start;
  const b = row.timeframe_end;
  if (a && b) {
    const days = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
    return `${days} days`;
  }
  return "90 days";
}

function deterministicFallback(params: {
  rawGoal: string;
  domain: string;
  purpose: string;
  timeframe: string;
  commitmentLevel: string;
}): RealityIntelligence {
  const domainKey = params.domain?.toLowerCase() ?? "genesis";
  const domainMomentum: Record<string, RealityIntelligence["marketMomentum"]> = {
    business: "growing",
    market: "growing",
    delivery: "growing",
    continuity: "emerging",
    genesis: "emerging",
  };
  return {
    marketMomentum: domainMomentum[domainKey] ?? "growing",
    demandConfidence: "medium",
    trendExplanation: `Framed demand read for "${domainKey}": intentional execution infra is consolidating around proof-linked progression — not motivational copy.`,
    similarConcepts: [
      {
        name: "Operator-grade execution infra",
        reason: "Converts ambiguous goals into auditable progression signals",
        outcome: "succeeded",
        lesson: "Sticky operators anchor on repeatable proof rituals and cold feedback loops",
        differentiationInsight: "Double down on reality coupling where competitors stay chatty",
      },
      {
        name: "Planner-first productivity suites",
        reason: "Optimizes comfort of planning over measurement of execution",
        outcome: "failed",
        lesson: "No structural enforcement → sharp early churn after novelty fades",
        differentiationInsight: "Contrast explicitly with planning comfort — sell measured proof",
      },
    ],
    positioning: {
      strongestAngle: `Reality-aligned execution rails in ${domainKey} with explicit proof obligations`,
      weakestAngle: "Narrative risk: mistaken for generic assistant chatter",
      userMisconception: "Risk of interpreting the system as passive advice rather than enforced progression",
      differentiationPath: "Own execution headquarters + externally verifiable milestones",
      positioningRule: "Only evidence-backed motion advances blueprint position",
    },
    whiteSpace: {
      underservedUsers: ["Operators who tolerate friction if truth is enforced"],
      emotionalGaps: ["Shame spikes after hollow planning streaks"],
      executionGaps: ["No cheap bridge from intent → measurable artifact"],
      competitorWeaknesses: ["Celebrate intent; under-invest in resistant proof UX"],
      unclaimedPositioning: ["Individual execution HQ", "Reality-conditioned progression rails"],
      opportunityPath:
        params.purpose.trim().length > 0
          ? `Leverage clarity on purpose ("${truncate(params.purpose, 96)}") to anchor proofs on outcomes users can show, not narrate`
          : "Anchor every phase exit on externally showable receipts",
    },
    timingAnalysis: {
      risk: "Category fog from undifferentiated AI wrappers",
      opportunity: "Execution buyers fatigued on plans — receptive to disciplined measurement",
      urgency: "moderate",
      reason: `${params.timeframe} window favors shipping proof-first demos before narratives commoditize`,
    },
    strategicWarnings: [
      "Do not inflate authority language — framing only",
      "Distribute proofs early; stealth planning produces false confidence",
      "Retention follows honest feedback graphs, not cheerleading",
    ],
    blueprintSeedInstructions: `Honor commitment "${params.commitmentLevel}" intensity: escalate proof density proportional to cadence promises. Goal anchor: "${truncate(params.rawGoal, 120)}".`,
    executionImplication:
      "If one principle governs sequencing: proofs must monotonically harden realism of the blueprint — nothing else substitutes.",
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export class RealityIntelligenceEngine {
  static async persist(blueprintId: string, intelligence: RealityIntelligence): Promise<void> {
    try {
      const [row] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
      if (!row) return;
      const meta = (row.intel_metadata as Record<string, unknown> | null) ?? {};
      await db
        .update(blueprints)
        .set({
          intel_metadata: {
            ...meta,
            realityIntelligence: intelligence,
            intelligenceGeneratedAt: new Date().toISOString(),
            marketMomentum: intelligence.marketMomentum,
            strongestAngle: intelligence.positioning.strongestAngle,
            blueprintSeedingInstructions: intelligence.blueprintSeedInstructions,
            executionImplication: intelligence.executionImplication,
          },
        })
        .where(eq(blueprints.id, blueprintId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[RealityIntelligence] Persist failed:", msg);
    }
  }

  static async retrieveNormalized(blueprintId: string): Promise<RealityIntelligence | null> {
    try {
      const [row] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
      const meta = row?.intel_metadata as Record<string, unknown> | undefined;
      const raw = meta?.["realityIntelligence"];
      return normalizeRealityIntelligenceData(raw);
    } catch {
      return null;
    }
  }

  static async analyze(params: {
    rawGoal?: string;
    goal?: string;
    domain: string;
    purpose: string;
    timeframe?: string;
    commitmentLevel?: string;
    currentContext?: string;
    blueprintId: string;
    userId: string;
  }): Promise<RealityIntelligence> {
    const rawGoal = params.rawGoal ?? params.goal ?? "";
    const purpose = params.purpose ?? "";

    let stateVersion = 0;
    let timeframe = params.timeframe ?? "90 days";
    let commitmentLevel = params.commitmentLevel ?? "medium";
    try {
      const [bp] = await db
        .select({
          state_version: blueprints.state_version,
          timeframe_start: blueprints.timeframe_start,
          timeframe_end: blueprints.timeframe_end,
          commitment_level: blueprints.commitment_level,
        })
        .from(blueprints)
        .where(eq(blueprints.id, params.blueprintId))
        .limit(1);
      stateVersion = bp?.state_version ?? 0;
      if (!params.timeframe) timeframe = bp ? formatBlueprintTimeframe(bp) : timeframe;
      if (!params.commitmentLevel && bp?.commitment_level)
        commitmentLevel = String(bp.commitment_level);
    } catch {
      stateVersion = 0;
    }

    try {
      const result = await routeBhudhiRequest<Record<string, unknown>>({
        sourceEngine: "RealityIntelligenceEngine",
        triggerType: "REALITY_INTELLIGENCE",
        userId: params.userId,
        blueprintId: params.blueprintId,
        stateVersion,
        idempotencyKey: `reality_intel:${params.blueprintId}:${Date.now()}`,
        facts: {
          rawGoal,
          goal: rawGoal,
          domain: params.domain,
          purpose,
          timeframe,
          commitmentLevel,
          currentContext: params.currentContext,
          stateVersion,
        },
      });

      const data = result.output?.data;
      if (result.ok && data && typeof data === "object") {
        const norm = normalizeRealityIntelligenceData(data);
        if (norm) {
          await RealityIntelligenceEngine.persist(params.blueprintId, norm);
          return norm;
        }
      }
    } catch {
      /* fallthrough */
    }

    const fb = deterministicFallback({
      rawGoal,
      domain: params.domain,
      purpose,
      timeframe,
      commitmentLevel,
    });
    await RealityIntelligenceEngine.persist(params.blueprintId, fb);
    return fb;
  }
}
