import { BhudhiCore } from "./BhudhiCore.js";
import type { BhudhiTrigger, BhudhiResponse } from "../types/bhudhi.js";

const core = new BhudhiCore();

/**
 * TriggerRouter — Routes incoming trigger requests to the correct prompt handler.
 * TODO (Prompt 3): Add per-trigger prompt templates from PromptRegistry
 */
export class TriggerRouter {
  async route(
    trigger: BhudhiTrigger,
    userId: string,
    context: Record<string, unknown>,
  ): Promise<BhudhiResponse> {
    return core.call({ trigger, userId, context });
  }
}
