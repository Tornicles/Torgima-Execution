import {
  db,
  bhudhiTemporalTimelines,
  bhudhiTemporalWindows,
  bhudhiTemporalForecasts,
  bhudhiTemporalPatterns,
  bhudhiTemporalHistory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { TemporalOutput } from "./contracts/types.js";

export async function persistTemporalSession(
  output: TemporalOutput,
  input: { blueprintId: string; goal?: string },
): Promise<void> {
  await db.insert(bhudhiTemporalTimelines).values({
    blueprint_id: input.blueprintId,
    goal: input.goal ?? null,
    timeline: output.chronology?.timeline ?? [],
    ordering: output.chronology?.ordering ?? [],
    causes: output.chronology?.causes ?? [],
    health: output.forecast?.horizons[2]?.confidence ?? 0.5,
    buffer_days: 2,
  });

  await db.insert(bhudhiTemporalWindows).values({
    blueprint_id: input.blueprintId,
    window_type: output.window.window,
    label: output.window.label,
    score: output.window.score,
    success_probability: output.window.successProbability,
    expires_at: output.window.expiresAt ? new Date(output.window.expiresAt) : null,
  });

  if (output.momentum) {
    await db.insert(bhudhiTemporalPatterns).values({
      blueprint_id: input.blueprintId,
      pattern_type: "momentum",
      description: `Trajectory ${output.momentum.trajectory}`,
      momentum_mode: output.momentum.trajectory,
      score: output.momentum.momentum,
    });
  }

  for (const h of output.forecast?.horizons ?? []) {
    await db.insert(bhudhiTemporalForecasts).values({
      blueprint_id: input.blueprintId,
      horizon_days: h.days,
      forecast: h.forecast,
      confidence: h.confidence,
      adjustments: output.forecast?.adjustments ?? [],
    });
  }

  await db.insert(bhudhiTemporalHistory).values({
    blueprint_id: input.blueprintId,
    event_type: "analyze",
    time_state: output.timeState,
    urgency: output.urgency,
    recommendation: output.recommendation,
  });
}

export async function listTemporalHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiTemporalHistory)
    .where(eq(bhudhiTemporalHistory.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiTemporalHistory.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    urgency: r.urgency,
    recommendation: r.recommendation,
    createdAt: r.created_at,
  }));
}
