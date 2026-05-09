import { BhudhiCore } from "./BhudhiCore.js";
import type { BhudhiTrigger, BhudhiResponse } from "../types/bhudhi.js";

const core = new BhudhiCore();

/**
 * TriggerRouter — Legacy wrapper. Prefer {@link import("./BhudhiCore.js").trigger}.
 */
export class TriggerRouter {
  async route(
    triggerName: BhudhiTrigger,
    userId: string,
    context: Record<string, unknown>,
  ): Promise<BhudhiResponse> {
    return core.call({ trigger: triggerName, userId, context });
  }
}
