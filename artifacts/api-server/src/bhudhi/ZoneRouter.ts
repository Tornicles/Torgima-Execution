/**
 * BHUDHI_UPGRADE_PROMPT 2 — 6-zone context routing for Bhudhi triggers.
 */
import {
  db,
  blueprints,
  conditions,
  enforcementPackages,
  signalSnapshots,
  inactivityRecords,
  behaviorPatterns,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { DomainIntelligenceService } from "./DomainIntelligenceService.js";
import { ExternalIntelligenceService } from "./ExternalIntelligenceService.js";
import { getActivePatterns } from "../engines/pattern/PatternLearningEngine.js";

export type BhudhiZone =
  | "CONTEXT ZONE"
  | "STRATEGY ZONE"
  | "EXECUTION ZONE"
  | "REALITY ZONE"
  | "ADAPTATION ZONE"
  | "GOVERNANCE ZONE";

const TRIGGER_ZONE: Partial<Record<BhudhiTriggerType | string, BhudhiZone>> = {
  GOAL_STRUCTURING: "CONTEXT ZONE",
  BLUEPRINT_GENERATION: "CONTEXT ZONE",
  DOMAIN_RESOLUTION: "STRATEGY ZONE",
  TASK_DRAFTING: "EXECUTION ZONE",
  EXECUTION_SUPPORT: "EXECUTION ZONE",
  ACADEMY_SUPPORT: "EXECUTION ZONE",
  FEEDBACK_CLASSIFICATION: "REALITY ZONE",
  STATE_EXPLANATION: "REALITY ZONE",
  ROOT_CAUSE_ASSIST: "REALITY ZONE",
  BEHAVIORAL_INSIGHT: "REALITY ZONE",
  RECOVERY_COPY: "ADAPTATION ZONE",
  INACTIVITY_RESTART: "ADAPTATION ZONE",
  OUTCOME_EVIDENCE_SUMMARY: "GOVERNANCE ZONE",
};

export const ZoneRouter = {
  getZoneForTrigger(triggerType: string): BhudhiZone {
    return TRIGGER_ZONE[triggerType] ?? "EXECUTION ZONE";
  },

  async buildZoneContext(params: {
    zone: BhudhiZone;
    userId: string;
    blueprintId?: string;
    triggerType: string;
  }): Promise<Record<string, unknown>> {
    if (!params.blueprintId) {
      return { zone: params.zone, triggerType: params.triggerType };
    }

    const [bp] = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    const [cond] = await db
      .select()
      .from(conditions)
      .where(
        and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)),
      )
      .limit(1);

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(
        and(
          eq(signalSnapshots.blueprint_id, params.blueprintId),
          eq(signalSnapshots.is_current, true),
        ),
      )
      .limit(1);

    const [enf] = await db
      .select()
      .from(enforcementPackages)
      .where(
        and(
          eq(enforcementPackages.blueprint_id, params.blueprintId),
          eq(enforcementPackages.is_current, true),
        ),
      )
      .limit(1);

    const domain = bp?.current_domain ?? "genesis";
    const domainProfile = DomainIntelligenceService.getDomainProfile(domain);

    const base: Record<string, unknown> = {
      zone: params.zone,
      domain,
      domainProfile,
      condition: cond?.condition ?? bp?.current_condition,
      signalSummary: signal
        ? {
            completion_rate: signal.completion_rate,
            weighted_score: signal.weighted_score,
            momentum: signal.momentum,
            trend: signal.trend,
            confidence: signal.confidence,
          }
        : null,
      enforcement: enf
        ? {
            difficulty_cap: enf.difficulty_cap,
            allowed_actions: enf.allowed_actions,
            blocked_actions: enf.blocked_actions,
          }
        : null,
      blueprintGoal: bp?.goal?.slice(0, 200),
    };

    if (params.zone === "EXECUTION ZONE") {
      const eis = await ExternalIntelligenceService.getLatestForBlueprint(params.blueprintId);
      if (eis) {
        base.externalContext = ExternalIntelligenceService.injectIntoTaskContext(eis);
      }
      const patterns = await getActivePatterns(params.userId, params.blueprintId);
      base.behaviorPatterns = patterns
        .filter((p) => ["medium", "high"].includes((p.severity ?? "").toLowerCase()))
        .slice(0, 3)
        .map((p) => ({
          type: p.pattern_type,
          severity: p.severity,
          summary:
            typeof p.evidence_json === "object" && p.evidence_json !== null && "summary" in p.evidence_json
              ? String((p.evidence_json as { summary?: string }).summary ?? p.pattern_type)
              : p.pattern_type,
        }));
    }

    if (params.zone === "ADAPTATION ZONE") {
      const [inact] = await db
        .select()
        .from(inactivityRecords)
        .where(
          and(
            eq(inactivityRecords.blueprint_id, params.blueprintId),
            eq(inactivityRecords.resolved, false),
          ),
        )
        .orderBy(desc(inactivityRecords.last_activity_at))
        .limit(1);
      base.inactivity = inact ?? null;
    }

    if (params.zone === "REALITY ZONE") {
      const patterns = await db
        .select()
        .from(behaviorPatterns)
        .where(
          and(
            eq(behaviorPatterns.user_id, params.userId),
            eq(behaviorPatterns.blueprint_id, params.blueprintId),
            eq(behaviorPatterns.status, "active"),
            inArray(behaviorPatterns.severity, ["MEDIUM", "HIGH", "medium", "high"]),
          ),
        )
        .orderBy(desc(behaviorPatterns.last_detected_at))
        .limit(3);
      base.behaviorPatterns = patterns.map((p) => ({
        type: p.pattern_type,
        severity: p.severity,
        summary: p.pattern_type,
      }));
    }

    return base;
  },
};
