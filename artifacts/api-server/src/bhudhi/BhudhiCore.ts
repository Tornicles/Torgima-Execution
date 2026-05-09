import { logger } from "../lib/logger.js";
import { anthropic, BHUDHI_MODEL, BHUDHI_MAX_TOKENS } from "../lib/anthropic.js";
import { BHUDHI_SYSTEM_PROMPT } from "../constants/bhudhi.js";
import type { BhudhiRequest, BhudhiResponse } from "../types/bhudhi.js";

/**
 * BhudhiCore — Main entry point for all AI calls.
 * All Claude API calls go through here. No engine or service calls Anthropic directly
 * except ValidationEngine (which calls this indirectly).
 *
 * TODO (Prompt 3): Implement full usage tracking and rate limiting via UsageController
 */
export class BhudhiCore {
  async call(request: BhudhiRequest): Promise<BhudhiResponse> {
    const startTime = Date.now();
    logger.info({ trigger: request.trigger, userId: request.userId }, "BhudhiCore.call");

    try {
      const prompt = this.buildPrompt(request);
      const response = await anthropic.messages.create({
        model: request.modelOverride ?? BHUDHI_MODEL,
        max_tokens: BHUDHI_MAX_TOKENS,
        system: BHUDHI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const output = JSON.parse(text) as Record<string, unknown>;

      return {
        trigger: request.trigger,
        output,
        model: response.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        latencyMs: Date.now() - startTime,
        valid: true,
        fallbackUsed: false,
      };
    } catch (err) {
      logger.error({ err, trigger: request.trigger }, "BhudhiCore.call — failed");
      return {
        trigger: request.trigger,
        output: {},
        model: BHUDHI_MODEL,
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        valid: false,
        fallbackUsed: true,
      };
    }
  }

  private buildPrompt(request: BhudhiRequest): string {
    return `Trigger: ${request.trigger}\n\nContext:\n${JSON.stringify(request.context, null, 2)}\n\nReturn a valid JSON object matching the expected output contract for this trigger.`;
  }
}
