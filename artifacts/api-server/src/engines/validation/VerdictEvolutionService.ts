import { db, verdictEvolution } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const VERDICT_RANK: Record<string, number> = {
  pivot: 0,
  adjust: 1,
  proceed: 2,
};

export async function recordVerdictEvolution(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  previousVerdict: string | null;
  newVerdict: string;
}): Promise<void> {
  if (!params.previousVerdict || params.previousVerdict === params.newVerdict) return;

  const prevRank = VERDICT_RANK[params.previousVerdict] ?? 0;
  const newRank = VERDICT_RANK[params.newVerdict] ?? 0;
  const improved = newRank > prevRank;

  const changeSummary =
    improved
      ? `Direction improved from ${params.previousVerdict} to ${params.newVerdict}.`
      : `Verdict changed from ${params.previousVerdict} to ${params.newVerdict}.`;

  await db.insert(verdictEvolution).values({
    validation_id: params.validationId,
    blueprint_id: params.blueprintId,
    user_id: params.userId,
    previous_verdict: params.previousVerdict,
    new_verdict: params.newVerdict,
    change_summary: changeSummary,
    improved,
  });
}

export async function getVerdictHistory(blueprintId: string) {
  return db
    .select()
    .from(verdictEvolution)
    .where(eq(verdictEvolution.blueprint_id, blueprintId))
    .orderBy(desc(verdictEvolution.created_at))
    .limit(20);
}
