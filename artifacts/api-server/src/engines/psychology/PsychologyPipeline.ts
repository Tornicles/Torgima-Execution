/**
 * Prompt 7 — post-feedback psychology orchestration.
 */
import { db, feedback } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scoreBurnoutRisk } from "../burnout/BurnoutDetectionEngine.js";
import { validateFeedbackOutcome } from "../outcome/OutcomeValidationFeedbackEngine.js";
import { runPatternAnalysis } from "../pattern/PatternRecordsEngine.js";
import { updateCharacterScores } from "../character/CharacterProgressionEngine.js";

export async function runPsychologyPostFeedback(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  completionStatus?: string;
}) {
  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  if (!fb) return;

  if (params.completionStatus === "completed" || params.completionStatus === "partial") {
    await validateFeedbackOutcome({
      userId: params.userId,
      feedbackId: params.feedbackId,
      orderId: params.orderId,
    }).catch(() => null);
  }

  // IL3: failure classification runs in FeedbackWorker (required path, not swallowed).

  await runPatternAnalysis(params.userId, params.blueprintId).catch(() => null);

  const feedbackCount = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(eq(feedback.user_id, params.userId))
    .limit(11);

  if (feedbackCount.length % 10 === 0) {
    await updateCharacterScores(params.userId).catch(() => null);
  }

  // IL1: identity + rewards run async via FeedbackWorker events (not inline).
}

export async function runPsychologyOvernight(userId: string, blueprintId?: string) {
  const burnout = await scoreBurnoutRisk(userId).catch(() => null);

  if (isDayOfWeek("sunday") && blueprintId) {
    await runPatternAnalysis(userId, blueprintId).catch(() => null);
    await updateCharacterScores(userId).catch(() => null);
  }

  return { burnout };
}

function isDayOfWeek(day: string): boolean {
  return (
    new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase() ===
    day.toLowerCase()
  );
}
