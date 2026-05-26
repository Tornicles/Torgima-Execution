import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePhaseFromEventCount } from "../../../bhudhi/modules/moduleHelpers.js";
import { IISModule } from "../../../bhudhi/modules/IISModule.js";
import { SISModule } from "../../../bhudhi/modules/SISModule.js";
import { PISModule } from "../../../bhudhi/modules/PISModule.js";
import { ModulesService } from "../../../bhudhi/modules/ModulesService.js";

function emptyQueryResult(): Promise<unknown[]> & {
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
} {
  const promise = Promise.resolve([]) as Promise<unknown[]> & {
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
  };
  promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) }));
  promise.limit = vi.fn().mockResolvedValue([]);
  promise.innerJoin = vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    })),
  }));
  return promise;
}

function drizzleChainMock() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => emptyQueryResult()),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
        })),
      })),
      orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    })),
  };
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => drizzleChainMock()),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  bhudhiModules: {},
  bhudhiExecutionEvents: {},
  bhudhiSignals: {},
  bhudhiContextStates: {},
  bhudhiIdeaSets: {},
  bhudhiStrategicChoices: {},
  bhudhiPredictions: {},
  bhudhiExecutionPlans: {},
  bhudhiExternalData: {},
  bhudhiExternalConnections: {},
  bhudhiFrameworks: {},
  bhudhiFrameworkLearning: {},
}));

vi.mock("../../../bhudhi/domains/DomainsService.js", () => ({
  domainsService: {
    getCurrentDomain: vi.fn().mockResolvedValue("delivery"),
  },
}));

vi.mock("../../../bhudhi/security/SecurityService.js", () => ({
  securityService: {
    checkCompliance: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../bhudhi/preservation/PreservationService.js", () => ({
  preservationService: {
    extractLearnings: vi.fn().mockResolvedValue(["learning_a"]),
  },
}));

describe("BHUDHI PROMPT 13 — Bhudhi 2.0 modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolvePhaseFromEventCount maps execution maturity", () => {
    expect(resolvePhaseFromEventCount(0)).toBe("initiation");
    expect(resolvePhaseFromEventCount(10)).toBe("exploration");
    expect(resolvePhaseFromEventCount(25)).toBe("execution");
    expect(resolvePhaseFromEventCount(60)).toBe("optimization");
    expect(resolvePhaseFromEventCount(100)).toBe("scaling");
  });

  it("IISModule generates 5+ ideas with ranked top idea", async () => {
    const iis = new IISModule();
    const result = await iis.generateIdeas("bp-test", "Next step");

    expect(result.ideas.length).toBeGreaterThanOrEqual(5);
    expect(result.topIdea.score).toBeGreaterThan(0);
    expect(result.topIdea.id).toBe(result.ideas[0]!.id);
  });

  it("SISModule selects highest-scored strategic option", async () => {
    const sis = new SISModule();
    const ideas = await new IISModule().generateIdeas("bp-test", "Grow revenue");
    const strategy = await sis.selectStrategy("bp-test", ideas.ideas);

    expect(strategy.selected).toBeTruthy();
    expect(strategy.confidence).toBeGreaterThan(0);
    expect(strategy.alternatives.length).toBeGreaterThan(0);
  });

  it("PISModule produces deterministic forecast for same title", async () => {
    const pis = new PISModule();
    const a = await pis.predictOutcome("bp-test", { title: "Hybrid approach" });
    const b = await pis.predictOutcome("bp-test", { title: "Hybrid approach" });
    expect(a.revenue).toBe(b.revenue);
    expect(a.timeline).toBe(b.timeline);
  });

  it("ModulesService.runCompleteCycle returns investigation, intelligence, execution", async () => {
    const service = new ModulesService();
    const cycle = await service.runCompleteCycle("bp-test");

    expect(cycle.investigation.context.currentDomain).toBe("delivery");
    expect(cycle.investigation.external.marketTrends.length).toBeGreaterThan(0);
    expect(cycle.investigation.behavior.adoptionLikelihood).toBeGreaterThan(0);
    expect(cycle.intelligence.ideas.ideas.length).toBeGreaterThanOrEqual(5);
    expect(cycle.intelligence.strategy.selected).toBeTruthy();
    expect(cycle.intelligence.prediction.confidence).toBeGreaterThan(0);
    expect(cycle.executionPlan.steps.length).toBe(4);
    expect(cycle.readyToExecute).toBe(true);
  });
});
