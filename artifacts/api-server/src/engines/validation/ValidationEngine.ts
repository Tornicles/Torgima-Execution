import { logger } from "../../lib/logger.js";
import { anthropic, BHUDHI_MODEL, BHUDHI_MAX_TOKENS } from "../../lib/anthropic.js";
import { BHUDHI_SYSTEM_PROMPT } from "../../constants/bhudhi.js";

export interface ValidationResult {
  valid: boolean;
  score: number;
  feedback: string;
  suggestedDomain: string | null;
  refinedGoal: string | null;
  issues: string[];
}

/**
 * ValidationEngine — Validates raw goals before blueprint creation.
 * Uses Bhudhi to assess specificity, achievability, and domain fit.
 *
 * TODO (Prompt 4): Implement structured validation with full Bhudhi output contract
 */
export class ValidationEngine {
  async validate(rawGoal: string, domain: string | null): Promise<ValidationResult> {
    logger.info({ rawGoal }, "ValidationEngine.validate");

    try {
      const prompt = `Validate this goal for the Torgima execution system.
Goal: "${rawGoal}"
${domain ? `Domain hint: ${domain}` : ""}

Return a JSON object with:
- valid: boolean (true if the goal is specific and achievable)
- score: integer 0-100 (specificity + achievability score)
- feedback: string (one sentence of direct feedback)
- suggestedDomain: string or null (genesis/market/delivery/continuity/identity/capability)
- refinedGoal: string or null (improved version of the goal if it needs refinement)
- issues: string[] (list of specific issues, empty if valid)

Return only valid JSON.`;

      const response = await anthropic.messages.create({
        model: BHUDHI_MODEL,
        max_tokens: 500,
        system: BHUDHI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(text) as ValidationResult;
      return parsed;
    } catch (err) {
      logger.error({ err }, "ValidationEngine.validate — Bhudhi call failed, using fallback");
      return {
        valid: rawGoal.trim().length > 10,
        score: rawGoal.trim().length > 30 ? 60 : 30,
        feedback: "Goal received. Bhudhi validation temporarily unavailable.",
        suggestedDomain: domain,
        refinedGoal: null,
        issues: rawGoal.trim().length <= 10 ? ["Goal is too vague — add specific details"] : [],
      };
    }
  }
}
