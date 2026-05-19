import { logger } from "../lib/logger.js";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { SignalService } from "./SignalService.js";
import type {
  Blueprint,
  BlueprintDraftInput,
  BlueprintStateView,
  BlueprintState,
} from "../types/blueprint.js";
import type { Order } from "../types/order.js";
import { db, orders, pivotReviews, blueprints as blueprintsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { checkCompletionEligibility } from "../engines/lifecycle/CompletionEngine.js";
import { PhaseStatus, PivotReviewStatus } from "@workspace/state-machine";

function mapDbOrderRow(row: typeof orders.$inferSelect): Order {
  const statusMap: Record<string, Order["status"]> = {
    pending:        "queued",
    active:         "active",
    paused:         "paused",
    blocked:        "blocked",
    needs_feedback: "in_progress",
    needs_proof:    "in_progress",
    completed:      "complete",
    failed:         "cancelled",
    skipped:        "cancelled",
    cancelled:      "cancelled",
  };
  return {
    id:               row.id,
    blueprintId:      row.blueprint_id,
    userId:           row.user_id,
    title:            row.title,
    description:      row.instruction,
    type:             row.task_type as Order["type"],
    status:           statusMap[row.status] ?? "active",
    priority:         row.priority,
    estimatedMinutes: row.time_estimate_minutes,
    instructions:     row.instruction,
    proofRequired:    row.proof_required,
    blockedReason:    row.blocker_description,
    startedAt:        row.started_at?.toISOString() ?? null,
    completedAt:      row.finished_at?.toISOString() ?? null,
    createdAt:        row.created_at.toISOString(),
  };
}

const engine = new BlueprintEngine();

export const BlueprintService = {
  async create(
    userId: string,
    input: BlueprintDraftInput,
  ): Promise<{ blueprintId: string }> {
    logger.info({ userId, goal: input.goal }, "BlueprintService.create");
    return engine.createDraft(userId, input);
  },

  async list(userId: string): Promise<Blueprint[]> {
    const rows = await BlueprintRepository.listForUser(userId);
    return rows.map((bp) => engine.mapToLegacy(bp));
  },

  async get(id: string, userId: string): Promise<Blueprint> {
    const bp = await BlueprintRepository.findById(id, userId);
    const allPhases = await BlueprintRepository.getPhases(id);
    const activePhase = allPhases.find((p) => p.status === PhaseStatus.ACTIVE);
    const currentPhaseIndex = activePhase
      ? allPhases.findIndex((p) => p.id === activePhase.id) + 1
      : 1;
    const totalPhases = allPhases.length || 3;
    return engine.mapToLegacy(bp, currentPhaseIndex, totalPhases);
  },

  async configureSelection(
    blueprintId: string,
    userId: string,
    input: { tier: "starter" | "growth" | "ultimate"; mode: "individual" | "team" },
  ) {
    return engine.configureSelection(blueprintId, userId, input);
  },

  async pause(id: string, userId: string, reason: string): Promise<Blueprint> {
    logger.info({ id, userId }, "BlueprintService.pause");
    const bp = await engine.pause(id, userId, reason);
    return engine.mapToLegacy(bp);
  },

  async resume(id: string, userId: string): Promise<Blueprint> {
    logger.info({ id, userId }, "BlueprintService.resume");
    const bp = await engine.resume(id, userId);
    return engine.mapToLegacy(bp);
  },

  async getHistory(userId: string): Promise<Blueprint[]> {
    const rows = await BlueprintRepository.listHistoryForUser(userId);
    return rows.map((bp) => engine.mapToLegacy(bp));
  },

  async getStateView(id: string, userId: string): Promise<BlueprintStateView> {
    return engine.getStateView(id, userId);
  },

  async getBlueprintState(id: string, userId: string): Promise<BlueprintState> {
    const bp = await BlueprintService.get(id, userId);

    const [signalOrders, signals] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, id),
            eq(orders.user_id, userId),
            inArray(orders.status, ["pending", "active"]),
          ),
        )
        .orderBy(desc(orders.priority)),
      SignalService.getCurrent(userId),
    ]);

    const stateView = await engine.getStateView(id, userId);
    const phaseProgress = stateView.position.phaseProgressPercent;

    const [[pivotOpen], [bpPause], eligibility] = await Promise.all([
      db
        .select({ id: pivotReviews.id })
        .from(pivotReviews)
        .where(
          and(
            eq(pivotReviews.blueprint_id, id),
            eq(pivotReviews.user_id, userId),
            eq(pivotReviews.status, PivotReviewStatus.OPEN),
          ),
        )
        .limit(1),
      db
        .select({ paused_at: blueprintsTable.paused_at })
        .from(blueprintsTable)
        .where(and(eq(blueprintsTable.id, id), eq(blueprintsTable.user_id, userId)))
        .limit(1),
      checkCompletionEligibility({ blueprintId: id, userId }),
    ]);

    return {
      blueprint: bp,
      activeOrders: signalOrders.map(mapDbOrderRow),
      signals,
      condition: stateView.condition ?? signals.condition,
      phaseProgress,
      pivotReviewOpen: Boolean(pivotOpen),
      pivotReviewId: pivotOpen?.id ?? null,
      completionEligible: eligibility.eligible,
      pausedAt: bpPause?.paused_at?.toISOString() ?? null,
    };
  },

  async findActive(userId: string): Promise<Blueprint | null> {
    const row = await BlueprintRepository.findActive(userId);
    if (!row) return null;
    return engine.mapToLegacy(row);
  },
};
