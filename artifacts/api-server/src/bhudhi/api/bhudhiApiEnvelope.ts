import type { Response } from "express";
import { success } from "../../lib/utils.js";

/** Standard Bhudhi API fields (Prompt 10). */
export interface BhudhiApiPayload {
  success: boolean;
  insight?: string;
  nextSteps?: string[];
  confidence?: number;
  reasoning?: string;
  [key: string]: unknown;
}

export function buildBhudhiPayload(payload: BhudhiApiPayload): Record<string, unknown> {
  const { success: ok, insight, nextSteps, confidence, reasoning, ...rest } = payload;
  return {
    success: ok,
    ...rest,
    ...(insight !== undefined ? { insight } : {}),
    ...(nextSteps !== undefined ? { nextSteps } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(reasoning !== undefined ? { reasoning } : {}),
  };
}

export function bhudhiSuccess(res: Response, payload: BhudhiApiPayload, status = 200): void {
  success(res, buildBhudhiPayload(payload), status);
}

export const BHUDHI_NEXT_STEPS = {
  investigate: [
    "POST /api/bhudhi/recommend to generate recommendations",
    "GET /api/bhudhi/insights for synthesized findings",
  ],
  recommend: [
    "Review top recommendation confidence and impact",
    "POST /api/bhudhi/recommendations/:id/approve then POST /api/bhudhi/execute",
  ],
  signals: [
    "GET /api/bhudhi/domains/current to see active domain",
    "POST /api/bhudhi/investigate if signals show risk",
  ],
  execute: [
    "POST /api/bhudhi/preservation/track-outcome after execution",
    "POST /api/bhudhi/signals to refresh global signal",
  ],
  external: [
    "POST /api/bhudhi/external/sync on a schedule",
    "POST /api/bhudhi/investigate to include external findings",
  ],
  status: [
    "POST /api/bhudhi/investigate → recommend → execute for full loop",
  ],
} as const;
