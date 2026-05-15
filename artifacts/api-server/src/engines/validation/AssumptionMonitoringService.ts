/**
 * Prompt 7 §7 — strategic assumptions accepted at validation; drift warnings.
 */

import { db, strategicAssumptions } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export async function recordStrategicAssumptions(params: {
  userId: string;
  blueprintId: string;
  validationId: string;
  assumptions: string[];
  industryContext?: string | null;
}): Promise<number> {
  let count = 0;
  for (const text of params.assumptions) {
    const trimmed = text.trim();
    if (trimmed.length < 8) continue;
    await db.insert(strategicAssumptions).values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      validation_id: params.validationId,
      assumption_text: trimmed.slice(0, 1000),
      industry_context: params.industryContext ?? null,
      monitoring_status: "active",
    });
    count++;
  }
  return count;
}

export type AssumptionDriftWarning = {
  assumptionId: string;
  assumptionText: string;
  severity: "warning" | "critical";
  message: string;
};

/**
 * Deterministic drift heuristics — surfaces stale strategic context without silent continuation.
 */
export async function checkAssumptionDrift(params: {
  userId: string;
  blueprintId: string;
  daysSinceValidation?: number;
  condition?: string | null;
  completionRate?: number;
}): Promise<AssumptionDriftWarning[]> {
  const rows = await db
    .select()
    .from(strategicAssumptions)
    .where(
      and(
        eq(strategicAssumptions.user_id, params.userId),
        eq(strategicAssumptions.blueprint_id, params.blueprintId),
        eq(strategicAssumptions.monitoring_status, "active"),
      ),
    );

  const warnings: AssumptionDriftWarning[] = [];
  const days = params.daysSinceValidation ?? 0;
  const cond = (params.condition ?? "").toLowerCase();
  const completion = params.completionRate ?? 1;

  for (const row of rows) {
    const text = row.assumption_text.toLowerCase();

    if (
      days >= 30 &&
      (text.includes("market") || text.includes("demand") || text.includes("rising"))
    ) {
      warnings.push({
        assumptionId: row.id,
        assumptionText: row.assumption_text,
        severity: "warning",
        message:
          "A market-timing assumption from validation may be stale — consider re-validating before scaling execution.",
      });
      continue;
    }

    if (cond === "danger" && (text.includes("growth") || text.includes("scale"))) {
      warnings.push({
        assumptionId: row.id,
        assumptionText: row.assumption_text,
        severity: "critical",
        message:
          "Growth assumptions conflict with current protective conditioning — execution is constrained until recovery.",
      });
      continue;
    }

    if (completion < 0.35 && text.includes("consistent demand")) {
      warnings.push({
        assumptionId: row.id,
        assumptionText: row.assumption_text,
        severity: "warning",
        message:
          "Demand consistency was assumed at validation but recent completion signal is weak — review whether the assumption still holds.",
      });
    }
  }

  return warnings;
}

export async function markAssumptionReviewed(assumptionId: string): Promise<void> {
  await db
    .update(strategicAssumptions)
    .set({ monitoring_status: "reviewed", last_reviewed_at: new Date() })
    .where(eq(strategicAssumptions.id, assumptionId));
}
