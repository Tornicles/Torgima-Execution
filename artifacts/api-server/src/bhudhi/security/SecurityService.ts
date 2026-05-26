import {
  db,
  bhudhiExternalConnections,
  bhudhiExecutionEvents,
  bhudhiSignals,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { intelligenceService } from "../intelligence/IntelligenceService.js";
import {
  decryptDataBase64,
  encryptDataBase64,
  evaluateRecommendationChecks,
  isCompliantSystemType,
} from "./securityLogic.js";
import type { SecurityValidationResult } from "./types.js";
import { logger } from "../../lib/logger.js";

export class SecurityService {
  async validateRecommendation(
    recommendationId: string,
    blueprintId: string,
  ): Promise<SecurityValidationResult> {
    const recommendation = await intelligenceService.getRecommendation(recommendationId);

    if (!recommendation) {
      return { valid: false, violations: ["Recommendation not found"] };
    }

    if (recommendation.blueprintId !== blueprintId) {
      return { valid: false, violations: ["Recommendation does not belong to blueprint"] };
    }

    const compliant = await this.checkCompliance(blueprintId);
    const result = evaluateRecommendationChecks(
      {
        expectedRevenue: recommendation.expectedImpact?.revenue,
        riskProbability: recommendation.risks?.probability,
        adoptionLikelihood: recommendation.stakeholderImpact?.adoptionLikelihood,
        strategicallyAligned: recommendation.strategicAlignment?.aligned,
      },
      compliant,
    );

    if (!result.valid) {
      logger.info(
        { recommendationId, blueprintId, violations: result.violations },
        "[Security] recommendation validation failed",
      );
    }

    return { valid: result.valid, violations: result.violations };
  }

  async checkCompliance(blueprintId: string): Promise<boolean> {
    const connections = await db
      .select({ system_type: bhudhiExternalConnections.system_type })
      .from(bhudhiExternalConnections)
      .where(
        and(
          eq(bhudhiExternalConnections.blueprint_id, blueprintId),
          eq(bhudhiExternalConnections.status, "active"),
        ),
      );

    for (const connection of connections) {
      if (!isCompliantSystemType(connection.system_type)) {
        return false;
      }
    }
    return true;
  }

  async detectThreats(blueprintId: string): Promise<string[]> {
    const threats: string[] = [];

    const recentEvents = await db
      .select({
        event_type: bhudhiExecutionEvents.event_type,
        data: bhudhiExecutionEvents.data,
      })
      .from(bhudhiExecutionEvents)
      .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiExecutionEvents.created_at))
      .limit(20);

    const failedCount = recentEvents.filter((e) => {
      const data = e.data as Record<string, unknown> | null;
      return e.event_type === "task_completed" && data?.status === "failed";
    }).length;

    if (failedCount > 5) {
      threats.push(`High failure rate detected: ${failedCount} failures`);
    }

    const signals = await db
      .select({ global_signal: bhudhiSignals.global_signal })
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(2);

    if (signals.length > 1) {
      const signalChanged = signals[0]!.global_signal !== signals[1]!.global_signal;
      const latest = signals[0]!.global_signal;
      if (signalChanged && (latest === "danger" || latest === "urgency")) {
        threats.push("Rapid signal degradation detected");
      }
    }

    return threats;
  }

  encryptData(data: unknown): string {
    return encryptDataBase64(data);
  }

  decryptData(encrypted: string): unknown {
    return decryptDataBase64(encrypted);
  }
}

export const securityService = new SecurityService();
