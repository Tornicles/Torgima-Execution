import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { SignalService } from "./SignalService.js";
import { OrderService } from "./OrderService.js";
import type {
  Blueprint,
  BlueprintDraftInput,
  BlueprintStateView,
  BlueprintState,
} from "../types/blueprint.js";

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
    const activePhase = allPhases.find((p) => p.status === "active");
    const currentPhaseIndex = activePhase
      ? allPhases.findIndex((p) => p.id === activePhase.id) + 1
      : 1;
    const totalPhases = allPhases.length || 3;
    return engine.mapToLegacy(bp, currentPhaseIndex, totalPhases);
  },

  async activate(blueprintId: string, userId: string): Promise<{ launched: true; blueprintId: string }> {
    logger.info({ blueprintId, userId }, "BlueprintService.activate");
    return engine.activateBlueprint(blueprintId, userId);
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
    const [activeOrders, signals] = await Promise.all([
      OrderService.getActive(userId),
      SignalService.getCurrent(userId),
    ]);

    const stateView = await engine.getStateView(id, userId);
    const phaseProgress = stateView.position.phaseProgressPercent;

    return {
      blueprint: bp,
      activeOrders,
      signals,
      condition: stateView.condition ?? signals.condition,
      phaseProgress,
    };
  },

  async findActive(userId: string): Promise<Blueprint | null> {
    const row = await BlueprintRepository.findActive(userId);
    if (!row) return null;
    return engine.mapToLegacy(row);
  },
};
