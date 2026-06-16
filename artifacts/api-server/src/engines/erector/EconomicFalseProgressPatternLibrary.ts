import { eq } from "drizzle-orm";
import { db, erectorFalseProgressPatterns } from "@workspace/db";

export interface ArchetypePatternRow {
  pattern_id: string;
  archetype: string;
  pattern_name: string;
  pattern_description: string;
  detection_logic: string;
  example: string;
  response_action: string;
  severity: string;
}

export interface ArchetypePatternContext {
  featuresShipped?: number;
  retention7d?: number;
  signupCount?: number;
  transactionCount?: number;
  brandingTasks?: number;
  salesConversations?: number;
  viewCount?: number;
  ownedAudienceSize?: number;
  contentPieces?: number;
  qualifiedConversations?: number;
  newSignups?: number;
  churn30d?: number;
  waitlistSize?: number;
  marginValidated?: boolean;
  articlesPublished?: number;
  salesOrOptIns?: number;
  memberCount?: number;
  monthlyActive?: number;
  missionEvents?: number;
  documentedOutcomes?: number;
}

export async function loadArchetypeFalseProgressPatterns(
  archetype: string,
): Promise<ArchetypePatternRow[]> {
  const rows = await db
    .select()
    .from(erectorFalseProgressPatterns)
    .where(eq(erectorFalseProgressPatterns.archetype, archetype));

  return rows.map((row) => ({
    pattern_id: row.pattern_id,
    archetype: row.archetype,
    pattern_name: row.pattern_name,
    pattern_description: row.pattern_description,
    detection_logic: row.detection_logic,
    example: row.example,
    response_action: row.response_action,
    severity: row.severity,
  }));
}

export function evaluateArchetypePattern(
  pattern: ArchetypePatternRow,
  context: ArchetypePatternContext,
): { triggered: boolean; detection_evidence: string } {
  switch (pattern.pattern_id) {
    case "FP-saas-01": {
      const triggered =
        (context.featuresShipped ?? 0) >= 3 && (context.retention7d ?? 100) < 20;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.featuresShipped} features shipped with ${context.retention7d}% 7-day retention`
          : "",
      };
    }
    case "FP-marketplace-01": {
      const triggered =
        (context.signupCount ?? 0) > 0 && (context.transactionCount ?? 0) === 0;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.signupCount} signups with zero transactions`
          : "",
      };
    }
    case "FP-service-01": {
      const triggered =
        (context.brandingTasks ?? 0) >= 3 && (context.salesConversations ?? 0) === 0;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.brandingTasks} branding tasks without sales conversations`
          : "",
      };
    }
    case "FP-content-01": {
      const triggered =
        (context.viewCount ?? 0) > 1000 && (context.ownedAudienceSize ?? 0) < 50;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.viewCount} views with owned audience ${context.ownedAudienceSize}`
          : "",
      };
    }
    case "FP-consulting-01": {
      const triggered =
        (context.contentPieces ?? 0) >= 3 && (context.qualifiedConversations ?? 0) === 0;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.contentPieces} content pieces without qualified conversations`
          : "",
      };
    }
    case "FP-subscription-01": {
      const triggered =
        (context.newSignups ?? 0) >= 100 && (context.churn30d ?? 0) > 60;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.newSignups} signups with ${context.churn30d}% 30-day churn`
          : "",
      };
    }
    case "FP-physical-01": {
      const triggered =
        (context.waitlistSize ?? 0) >= 100 && context.marginValidated !== true;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.waitlistSize} waitlist entries without validated margin`
          : "",
      };
    }
    case "FP-info-01": {
      const triggered =
        (context.articlesPublished ?? 0) >= 10 && (context.salesOrOptIns ?? 0) === 0;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.articlesPublished} articles with zero sales or opt-ins`
          : "",
      };
    }
    case "FP-collective-01": {
      const memberCount = context.memberCount ?? 0;
      const monthlyActive = context.monthlyActive ?? 0;
      const participationRate =
        memberCount > 0 ? (monthlyActive / memberCount) * 100 : 100;
      const triggered = memberCount >= 100 && participationRate < 10;
      return {
        triggered,
        detection_evidence: triggered
          ? `${memberCount} members with ${participationRate.toFixed(1)}% participation`
          : "",
      };
    }
    case "FP-social-01": {
      const triggered =
        (context.missionEvents ?? 0) >= 10 && (context.documentedOutcomes ?? 0) === 0;
      return {
        triggered,
        detection_evidence: triggered
          ? `${context.missionEvents} mission events with zero documented outcomes`
          : "",
      };
    }
    default:
      return { triggered: false, detection_evidence: "" };
  }
}

export function evaluateArchetypePatterns(
  patterns: ArchetypePatternRow[],
  context: ArchetypePatternContext,
): Array<{
  pattern_id: string;
  pattern_name: string;
  archetype: string;
  detection_evidence: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  response_action: string;
}> {
  const triggered = [];

  for (const pattern of patterns) {
    const result = evaluateArchetypePattern(pattern, context);
    if (!result.triggered) continue;

    const severityRaw = (pattern.severity ?? "MEDIUM").toUpperCase();
    const severity =
      severityRaw === "CRITICAL"
        ? "CRITICAL"
        : severityRaw === "HIGH"
          ? "HIGH"
          : severityRaw === "LOW"
            ? "LOW"
            : "MEDIUM";

    triggered.push({
      pattern_id: pattern.pattern_id,
      pattern_name: pattern.pattern_name,
      archetype: pattern.archetype,
      detection_evidence: result.detection_evidence,
      severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      response_action: pattern.response_action,
    });
  }

  return triggered;
}
