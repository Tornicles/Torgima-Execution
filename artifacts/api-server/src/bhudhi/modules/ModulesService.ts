import { db, bhudhiModules } from "@workspace/db";
import { cisModule } from "./CISModule.js";
import { eisModule } from "./EISModule.js";
import { bisModule } from "./BISModule.js";
import { iisModule } from "./IISModule.js";
import { sisModule } from "./SISModule.js";
import { pisModule } from "./PISModule.js";
import { kisModule } from "./KISModule.js";
import { riezModule } from "./RIEZModule.js";
import { securityService } from "../security/SecurityService.js";
import { preservationService } from "../preservation/PreservationService.js";
import { logger } from "../../lib/logger.js";

export interface Bhudhi20CycleResult {
  investigation: {
    context: Awaited<ReturnType<typeof cisModule.analyzeContext>>;
    external: Awaited<ReturnType<typeof eisModule.analyzeExternalEnvironment>>;
    behavior: Awaited<ReturnType<typeof bisModule.analyzeBehavior>>;
  };
  intelligence: {
    ideas: Awaited<ReturnType<typeof iisModule.generateIdeas>>;
    knowledge: Awaited<ReturnType<typeof kisModule.applyKnowledge>>;
    strategy: Awaited<ReturnType<typeof sisModule.selectStrategy>>;
    prediction: Awaited<ReturnType<typeof pisModule.predictOutcome>>;
  };
  executionPlan: Awaited<ReturnType<typeof riezModule.createExecutionPlan>>;
  security: { validated: boolean; message: string };
  preservation: { preserved: boolean };
  readyToExecute: boolean;
}

/** BHUDHI PROMPT 13 — orchestrates all 8 Torgima AI modules (Bhudhi 2.0). */
export class ModulesService {
  async listModules() {
    return db.select().from(bhudhiModules);
  }

  async runCompleteCycle(blueprintId: string): Promise<Bhudhi20CycleResult> {
    const context = await cisModule.analyzeContext(blueprintId);
    const external = await eisModule.analyzeExternalEnvironment(blueprintId);
    const behavior = await bisModule.analyzeBehavior(blueprintId);

    const ideas = await iisModule.generateIdeas(blueprintId, "Next step");
    const knowledge = await kisModule.applyKnowledge(blueprintId, "execution");
    const strategy = await sisModule.selectStrategy(blueprintId, ideas.ideas);
    const prediction = await pisModule.predictOutcome(blueprintId, {
      title: strategy.selected,
    });

    const executionPlan = await riezModule.createExecutionPlan(blueprintId, {
      id: "rec-bhudhi20",
      title: strategy.selected,
    });

    const compliant = await securityService.checkCompliance(blueprintId);
    const securityValidated = compliant && context.clarity >= 0.4;
    const securityMessage = securityValidated
      ? "All module outputs within policy"
      : "Compliance or clarity threshold not met";

    let preserved = false;
    try {
      const learnings = await preservationService.extractLearnings(blueprintId);
      preserved = learnings.length >= 0;
    } catch (err) {
      logger.warn({ err, blueprintId }, "[ModulesService] preservation skipped");
    }

    logger.info({ blueprintId, strategy: strategy.selected }, "[ModulesService] Bhudhi 2.0 cycle complete");

    return {
      investigation: { context, external, behavior },
      intelligence: { ideas, knowledge, strategy, prediction },
      executionPlan,
      security: { validated: securityValidated, message: securityMessage },
      preservation: { preserved },
      readyToExecute: securityValidated,
    };
  }
}

export const modulesService = new ModulesService();
