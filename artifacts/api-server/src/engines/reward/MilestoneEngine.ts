/**
 * DOC19 — milestone reward eligibility (outcome-validated milestones only).
 */

import { db, milestones, outcomeValidations } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export async function isMilestoneRewardEligible(params: {
  milestoneId: string;
  userId: string;
  blueprintId?: string;
}): Promise<boolean> {
  const [milestone] = await db
    .select({
      id: milestones.id,
      metadata_json: milestones.metadata_json,
      blueprint_id: milestones.blueprint_id,
    })
    .from(milestones)
    .where(and(eq(milestones.id, params.milestoneId), eq(milestones.user_id, params.userId)))
    .limit(1);

  if (!milestone) return false;

  const meta = (milestone.metadata_json ?? {}) as Record<string, unknown>;
  const outcomeValidationId =
    typeof meta.outcome_validation_id === "string"
      ? meta.outcome_validation_id
      : typeof meta.outcomeValidationId === "string"
        ? meta.outcomeValidationId
        : null;

  if (!outcomeValidationId) {
    return false;
  }

  const [validation] = await db
    .select({ id: outcomeValidations.id })
    .from(outcomeValidations)
    .where(
      and(
        eq(outcomeValidations.id, outcomeValidationId),
        eq(outcomeValidations.user_id, params.userId),
        eq(outcomeValidations.verdict, "VALIDATED"),
      ),
    )
    .limit(1);

  return Boolean(validation);
}

export async function loadMilestoneRecord(milestoneId: string, userId: string) {
  const [row] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.user_id, userId)))
    .limit(1);
  return row ?? null;
}
