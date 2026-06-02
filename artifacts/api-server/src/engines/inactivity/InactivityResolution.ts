import { db, inactivityRecords } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/** Phase 1 — resolve open inactivity records when user submits feedback. */
export async function resolveInactivityOnFeedback(
  userId: string,
  blueprintId: string,
): Promise<number> {
  const updated = await db
    .update(inactivityRecords)
    .set({
      resolved: true,
      resolved_at: new Date(),
      response_triggered: "feedback_submitted",
    })
    .where(
      and(
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .returning({ id: inactivityRecords.id });

  return updated.length;
}
