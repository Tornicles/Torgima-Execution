/**
 * Persist permanent Production / Operations / Growth / Scale signals (never deleted).
 */
import { blueprintFrameworkSignals, db, feedback } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  calculateFrameworkSignalsFromFeedback,
  interpretSignalValue,
  SIGNAL_FEEDBACK_WINDOW,
  trendFromHistory,
  trendFromMomentum,
} from "../engines/signal/FrameworkSignalCalculationEngine.js";
import type {
  FrameworkSignalsBundle,
  PermanentSignalKey,
} from "../types/framework-signals.js";
import { PERMANENT_SIGNAL_KEYS } from "../types/framework-signals.js";

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function readPermanentFrameworkSignals(
  blueprintId: string,
): Promise<FrameworkSignalsBundle | null> {
  const rows = await db
    .select()
    .from(blueprintFrameworkSignals)
    .where(eq(blueprintFrameworkSignals.blueprint_id, blueprintId));

  if (rows.length === 0) return null;

  const signals = {} as FrameworkSignalsBundle["signals"];
  let maxConfidence = 0.3;

  for (const key of PERMANENT_SIGNAL_KEYS) {
    const row = rows.find((r) => r.signal_key === key);
    if (!row) continue;
    maxConfidence = Math.max(maxConfidence, row.confidence);
    const previousValue = row.previous_value ?? row.value;
    signals[key] = {
      key,
      value: row.value,
      previousValue,
      momentum: row.momentum,
      change: row.value - previousValue,
      trend: (row.trend as "improving" | "declining" | "stable") ?? "stable",
      confidence: row.confidence,
      statusLabel:
        String((row.metadata_json as Record<string, unknown>)?.statusLabel ?? "") ||
        interpretSignalValue(key, row.value),
      metadata: (row.metadata_json as Record<string, unknown>) ?? {},
      valueHistory:
        ((row.metadata_json as Record<string, unknown>)?.valueHistory as Record<string, number>) ??
        { [todayKey()]: row.value },
    };
  }

  if (Object.keys(signals).length < 4) return null;

  return {
    signals,
    feedbackCount: Number(
      (rows[0]?.metadata_json as Record<string, unknown>)?.feedbackCount ?? SIGNAL_FEEDBACK_WINDOW,
    ),
    calculatedAt: rows[0]?.updated_at?.toISOString() ?? new Date().toISOString(),
  };
}

export async function initializePermanentFrameworkSignals(blueprintId: string): Promise<void> {
  for (const key of PERMANENT_SIGNAL_KEYS) {
    await db
      .insert(blueprintFrameworkSignals)
      .values({
        blueprint_id: blueprintId,
        signal_key: key,
        value: 0.5,
        previous_value: 0.5,
        momentum: 0,
        trend: "stable",
        confidence: 0.3,
        value_history: {},
        metadata_json: { statusLabel: "Acceptable", seeded: true },
      })
      .onConflictDoNothing();
  }
}

export async function recalculatePermanentFrameworkSignals(input: {
  blueprintId: string;
  userId: string;
}): Promise<FrameworkSignalsBundle> {
  const lastFeedbacks = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, input.blueprintId), eq(feedback.user_id, input.userId)))
    .orderBy(desc(feedback.created_at))
    .limit(SIGNAL_FEEDBACK_WINDOW);

  const existing = await db
    .select()
    .from(blueprintFrameworkSignals)
    .where(eq(blueprintFrameworkSignals.blueprint_id, input.blueprintId));

  if (existing.length < 4) {
    await initializePermanentFrameworkSignals(input.blueprintId);
  }

  const prior: Partial<Record<PermanentSignalKey, number>> = {};
  for (const row of existing) {
    prior[row.signal_key as PermanentSignalKey] = row.value;
  }

  const bundle = calculateFrameworkSignalsFromFeedback(lastFeedbacks, prior);
  const day = todayKey();

  for (const key of PERMANENT_SIGNAL_KEYS) {
    const sig = bundle.signals[key];
    const prevRow = existing.find((r) => r.signal_key === key);
    const history = {
      ...((prevRow?.value_history as Record<string, number>) ?? {}),
      [day]: sig.value,
    };
    const trimmedHistory = Object.fromEntries(Object.entries(history).slice(-30));
    const historyValues = Object.values(trimmedHistory);
    const trend =
      historyValues.length >= 4
        ? trendFromHistory(historyValues)
        : trendFromMomentum(sig.momentum);

    await db
      .insert(blueprintFrameworkSignals)
      .values({
        blueprint_id: input.blueprintId,
        signal_key: key,
        value: sig.value,
        previous_value: sig.previousValue,
        momentum: sig.momentum,
        trend: sig.trend,
        confidence: sig.confidence,
        value_history: trimmedHistory,
        metadata_json: {
          ...sig.metadata,
          statusLabel: sig.statusLabel,
          feedbackCount: bundle.feedbackCount,
        },
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [blueprintFrameworkSignals.blueprint_id, blueprintFrameworkSignals.signal_key],
        set: {
          value: sig.value,
          previous_value: sig.previousValue,
          momentum: sig.momentum,
          trend: sig.trend,
          confidence: sig.confidence,
          value_history: trimmedHistory,
          metadata_json: {
            ...sig.metadata,
            statusLabel: sig.statusLabel,
            feedbackCount: bundle.feedbackCount,
          },
          updated_at: new Date(),
        },
      });
  }

  const fresh = await readPermanentFrameworkSignals(input.blueprintId);
  return fresh ?? bundle;
}

export function permanentSignalsToRecord(
  bundle: FrameworkSignalsBundle,
): Record<string, number> {
  return {
    Production: bundle.signals.Production.value,
    Operations: bundle.signals.Operations.value,
    Growth: bundle.signals.Growth.value,
    Scale: bundle.signals.Scale.value,
    momentum: bundle.signals.Production.momentum,
  };
}

/** API shape for SIGNAL_SYSTEM_SPECIFICATION dashboard. */
export function frameworkSignalsToApiPayload(bundle: FrameworkSignalsBundle) {
  const mapSignal = (sig: FrameworkSignalsBundle["signals"][PermanentSignalKey]) => ({
    key: sig.key,
    value: sig.value,
    previousValue: sig.previousValue,
    change: sig.change ?? sig.value - sig.previousValue,
    momentum: sig.momentum,
    trend: sig.trend,
    confidence: sig.confidence,
    statusLabel: sig.statusLabel,
    metadata: sig.metadata,
    valueHistory: sig.valueHistory ?? {},
    detailLine: formatSignalDetailLine(sig.key, sig.metadata),
  });

  return {
    production: mapSignal(bundle.signals.Production),
    operations: mapSignal(bundle.signals.Operations),
    growth: mapSignal(bundle.signals.Growth),
    scale: mapSignal(bundle.signals.Scale),
    feedbackCount: bundle.feedbackCount,
    calculatedAt: bundle.calculatedAt,
    overallConfidence: Math.max(
      bundle.signals.Production.confidence,
      bundle.signals.Operations.confidence,
      bundle.signals.Growth.confidence,
      bundle.signals.Scale.confidence,
    ),
  };
}

function formatSignalDetailLine(
  key: PermanentSignalKey,
  metadata: Record<string, unknown>,
): string {
  if (key === "Production") {
    const completed = Number(metadata.completed ?? 0);
    const partial = Number(metadata.partial ?? 0);
    const total = Number(metadata.total ?? 0);
    if (total > 0) return `${completed}/${total} completed, ${partial} partial`;
    return "Completion rate from recent feedback";
  }
  if (key === "Operations") {
    const avg = Number(metadata.average_score ?? 0);
    const blockers = Number(metadata.blocker_count ?? 0);
    return `Avg score: ${avg.toFixed(1)}, ${blockers} blockers`;
  }
  if (key === "Growth") {
    const learning = Number(metadata.learning_quality ?? 0);
    return `Learning visible (${Math.round(learning * 100)}% reflection quality)`;
  }
  const consistency = Number(metadata.execution_consistency ?? metadata.score_variance ?? 0);
  return `Consistent execution (${Math.round((1 - consistency) * 100)}% stability)`;
}
