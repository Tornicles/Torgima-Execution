import {
  db,
  validationAtAGlance,
  validationBhudhiResearchLog,
  validationCompetitors,
  validationMarketTrends,
  validationOpportunities,
  validationPaths,
  validationProsCons,
  validationRisks,
  validationRuns,
} from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import type { ValidationRunInput } from "../engines/erector/ValidationResearchEngine.js";
import { getBoss } from "../lib/queue.js";
import { writeEvent } from "./EventService.js";
import { VALIDATION_RUN_QUEUE } from "../workers/ValidationResearchWorker.js";
import { EventTypes } from "../types/eventContracts.js";

async function resolveRunId(runOrLegacyId: string, userId: string): Promise<string> {
  const [byId] = await db
    .select({ id: validationRuns.id })
    .from(validationRuns)
    .where(and(eq(validationRuns.id, runOrLegacyId), eq(validationRuns.user_id, userId)))
    .limit(1);
  if (byId?.id) return byId.id;

  const [byLegacy] = await db
    .select({ id: validationRuns.id })
    .from(validationRuns)
    .where(
      and(
        eq(validationRuns.legacy_validation_id, runOrLegacyId),
        eq(validationRuns.user_id, userId),
      ),
    )
    .limit(1);
  if (byLegacy?.id) return byLegacy.id;

  throw new TorgimaError("NOT_FOUND", "Validation run not found", false);
}

export const ErectorValidationUpgradeService = {
  resolveRunId,

  async startRun(input: ValidationRunInput): Promise<{ id: string; status: string }> {
    const [run] = await db
      .insert(validationRuns)
      .values({
        user_id: input.user_id,
        blueprint_draft_id: input.blueprint_draft_id ?? null,
        idea_title: input.idea_title,
        idea_description: input.idea_description ?? null,
        goal: input.goal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        context: input.context ?? null,
        commitment_level: input.commitment_level ?? null,
        known_blockers: input.known_blockers ?? null,
        status: "pending",
      })
      .returning({ id: validationRuns.id, status: validationRuns.status });

    if (!run) throw new Error("Failed to create validation run");

    const boss = await getBoss();
    await boss.send(VALIDATION_RUN_QUEUE, {
      run_id: run.id,
      user_id: input.user_id,
      input,
    });

    await writeEvent({
      eventType: EventTypes.VALIDATION_RUN_REQUESTED,
      entityType: "validation_run",
      entityId: run.id,
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id ?? undefined,
      payload: { run_id: run.id },
      idempotencyKey: `validation_run_requested:${run.id}`,
    }).catch(() => null);

    return { id: run.id, status: run.status };
  },

  async getStatus(runId: string, userId: string) {
    const resolvedId = await resolveRunId(runId, userId);
    const [run] = await db
      .select({
        id: validationRuns.id,
        status: validationRuns.status,
        verdict: validationRuns.verdict,
        reality_score: validationRuns.reality_score,
        blueprint_launched: validationRuns.blueprint_launched,
        selected_path: validationRuns.selected_path,
      })
      .from(validationRuns)
      .where(and(eq(validationRuns.id, resolvedId), eq(validationRuns.user_id, userId)))
      .limit(1);

    if (!run) throw new TorgimaError("NOT_FOUND", "Validation run not found", false);
    return run;
  },

  async getFullResults(runId: string, userId: string) {
    const resolvedId = await resolveRunId(runId, userId);
    const [run] = await db
      .select()
      .from(validationRuns)
      .where(and(eq(validationRuns.id, resolvedId), eq(validationRuns.user_id, userId)))
      .limit(1);

    if (!run) throw new TorgimaError("NOT_FOUND", "Validation run not found", false);

    const [glance, market, competitors, prosCons, opportunities, risks, paths, researchLog] =
      await Promise.all([
        db.select().from(validationAtAGlance).where(eq(validationAtAGlance.validation_run_id, resolvedId)),
        db.select().from(validationMarketTrends).where(eq(validationMarketTrends.validation_run_id, resolvedId)),
        db
          .select()
          .from(validationCompetitors)
          .where(eq(validationCompetitors.validation_run_id, resolvedId))
          .orderBy(validationCompetitors.rank),
        db
          .select()
          .from(validationProsCons)
          .where(eq(validationProsCons.validation_run_id, runId))
          .orderBy(asc(validationProsCons.sort_order)),
        db
          .select()
          .from(validationOpportunities)
          .where(eq(validationOpportunities.validation_run_id, runId))
          .orderBy(asc(validationOpportunities.sort_order)),
        db
          .select()
          .from(validationRisks)
          .where(eq(validationRisks.validation_run_id, runId))
          .orderBy(asc(validationRisks.sort_order)),
        db.select().from(validationPaths).where(eq(validationPaths.validation_run_id, runId)),
        db
          .select()
          .from(validationBhudhiResearchLog)
          .where(eq(validationBhudhiResearchLog.validation_run_id, runId)),
      ]);

    return {
      run,
      at_a_glance: glance[0] ?? null,
      market_trends: market[0] ?? null,
      competitors,
      pros_cons: prosCons,
      opportunities,
      risks,
      paths,
      research_log: researchLog,
    };
  },

  async selectPath(runId: string, userId: string, pathType: "current" | "adjusted" | "alternative") {
    const resolvedId = await resolveRunId(runId, userId);
    const [run] = await db
      .update(validationRuns)
      .set({ selected_path: pathType, updated_at: new Date() })
      .where(and(eq(validationRuns.id, resolvedId), eq(validationRuns.user_id, userId)))
      .returning();

    if (!run) throw new TorgimaError("NOT_FOUND", "Validation run not found", false);
    return run;
  },
};
