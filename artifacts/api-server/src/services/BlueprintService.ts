import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { generateId, now } from "../lib/utils.js";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { ValidationEngine } from "../engines/validation/ValidationEngine.js";
import { DomainResolutionEngine } from "../engines/domain/DomainResolutionEngine.js";
import { PauseEngine } from "../engines/lifecycle/PauseEngine.js";
import { ResumeEngine } from "../engines/lifecycle/ResumeEngine.js";
import type { Blueprint } from "../types/blueprint.js";

const blueprintEngine = new BlueprintEngine();
const validationEngine = new ValidationEngine();
const domainEngine = new DomainResolutionEngine();
const pauseEngine = new PauseEngine();
const resumeEngine = new ResumeEngine();

// In-memory store for Prompt 1 scaffold — replaced by BlueprintRepository in Prompt 3
const store = new Map<string, Blueprint>();

export const BlueprintService = {
  async create(userId: string, rawGoal: string, domain: string | null): Promise<Blueprint> {
    logger.info({ userId, rawGoal }, "BlueprintService.create");
    const resolvedDomain = domainEngine.resolve(rawGoal, domain);
    const partial = await blueprintEngine.structureGoal(rawGoal, resolvedDomain);
    const blueprint: Blueprint = {
      id: generateId(),
      userId,
      title: partial.title ?? rawGoal.slice(0, 80),
      rawGoal,
      domain: resolvedDomain,
      status: "draft",
      phase: 1,
      totalPhases: partial.totalPhases ?? 4,
      currentCondition: null,
      pausedReason: null,
      activatedAt: null,
      completedAt: null,
      createdAt: now(),
    };
    store.set(blueprint.id, blueprint);
    return blueprint;
  },

  async list(userId: string): Promise<Blueprint[]> {
    return Array.from(store.values()).filter((b) => b.userId === userId);
  },

  async get(id: string, userId: string): Promise<Blueprint> {
    const b = store.get(id);
    if (!b) throw new TorgimaError("NOT_FOUND", "Blueprint not found");
    if (b.userId !== userId) throw new TorgimaError("FORBIDDEN", "Access denied");
    return b;
  },

  async activate(id: string, userId: string): Promise<Blueprint> {
    const b = await BlueprintService.get(id, userId);
    if (b.status === "active") throw new TorgimaError("BLUEPRINT_NOT_ACTIVE", "Already active");
    const updated: Blueprint = { ...b, status: "active", activatedAt: now() };
    store.set(id, updated);
    return updated;
  },

  async pause(id: string, userId: string, reason: string): Promise<Blueprint> {
    const b = await BlueprintService.get(id, userId);
    if (b.status !== "active") throw new TorgimaError("BLUEPRINT_NOT_ACTIVE", "Blueprint is not active");
    const updated = pauseEngine.pause(b, reason);
    store.set(id, updated);
    return updated;
  },

  async resume(id: string, userId: string): Promise<Blueprint> {
    const b = await BlueprintService.get(id, userId);
    if (b.status !== "paused") throw new TorgimaError("BLUEPRINT_PAUSED", "Blueprint is not paused");
    const updated = resumeEngine.resume(b);
    store.set(id, updated);
    return updated;
  },

  async getHistory(userId: string): Promise<Blueprint[]> {
    return Array.from(store.values()).filter(
      (b) => b.userId === userId && (b.status === "complete" || b.status === "abandoned"),
    );
  },
};
