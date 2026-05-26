import { db, bhudhiSignals, bhudhiFrameworks } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { BhudhiSignal } from "@workspace/db/types/bhudhi";
import { getMetrics } from "./signalMetrics.js";
import {
  calculateGlobalSignal,
  getConfidence,
  getSignalInterpretation as interpretGlobalSignal,
  toBhudhiSignalMetrics,
} from "./signalCalculation.js";
import { calculateFrameworkSignal } from "./frameworkSignalLogic.js";
import type { FrameworkSignalsMap } from "./types.js";

function toBhudhiSignal(row: typeof bhudhiSignals.$inferSelect): BhudhiSignal {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    globalSignal: row.global_signal as BhudhiSignal["globalSignal"],
    globalSignalConfidence: row.global_signal_confidence,
    frameworkSignals: row.framework_signals as BhudhiSignal["frameworkSignals"],
    metrics: row.metrics as BhudhiSignal["metrics"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SignalService {
  async calculateSignals(blueprintId: string): Promise<BhudhiSignal> {
    const metrics = await getMetrics(blueprintId);
    const globalSignal = calculateGlobalSignal(metrics);
    const globalSignalConfidence = getConfidence(globalSignal, metrics);

    const frameworks = await db
      .select()
      .from(bhudhiFrameworks)
      .where(eq(bhudhiFrameworks.status, "active"));

    const frameworkSignals: FrameworkSignalsMap = {};
    for (const framework of frameworks) {
      frameworkSignals[framework.id] = calculateFrameworkSignal(
        blueprintId,
        framework.name,
        metrics,
      );
    }

    const metricsPayload = {
      ...toBhudhiSignalMetrics(metrics),
      extended: {
        clarity: metrics.clarity,
        throughput: metrics.throughput,
        feedbackRate: metrics.feedbackRate,
        riskScore: metrics.riskScore,
      },
    };

    const [row] = await db
      .insert(bhudhiSignals)
      .values({
        blueprint_id: blueprintId,
        global_signal: globalSignal,
        global_signal_confidence: globalSignalConfidence,
        framework_signals: frameworkSignals,
        metrics: metricsPayload,
      })
      .returning();

    return toBhudhiSignal(row!);
  }

  async getLatestSignal(blueprintId: string): Promise<BhudhiSignal | null> {
    const [row] = await db
      .select()
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(1);
    return row ? toBhudhiSignal(row) : null;
  }

  getSignalInterpretation(signal: BhudhiSignal["globalSignal"]): string {
    return interpretGlobalSignal(signal);
  }
}

export const signalService = new SignalService();
