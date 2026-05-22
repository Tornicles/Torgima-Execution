/** Prompt 4 — industry_state modifiers for action-type weighting in task generation. */
export const INDUSTRY_ACTION_WEIGHTS: Record<string, Record<string, number>> = {
  EMERGING: { create: 1.4, analyze: 1.3, replicate: 0.8, improve: 0.9 },
  GROWING: { create: 1.2, analyze: 1.0, replicate: 1.3, improve: 1.1 },
  STABLE: { create: 0.9, analyze: 1.2, replicate: 1.0, improve: 1.3 },
  SATURATED: { create: 0.7, analyze: 1.4, replicate: 0.9, improve: 1.5 },
  DECLINING: { create: 0.6, analyze: 1.5, replicate: 0.7, improve: 1.4 },
  OPPORTUNISTIC: { create: 1.5, analyze: 0.9, replicate: 1.2, improve: 0.8 },
  DANGEROUS: { create: 0.5, analyze: 1.6, replicate: 0.6, improve: 1.0 },
  FORMING: { create: 1.2, analyze: 1.1, replicate: 0.9, improve: 1.0 },
};

export function industryWeightForAction(industryState: string | null | undefined, actionType: string | null | undefined): number {
  const state = (industryState ?? "STABLE").toUpperCase();
  const weights = INDUSTRY_ACTION_WEIGHTS[state] ?? INDUSTRY_ACTION_WEIGHTS.STABLE;
  const key = (actionType ?? "create").toLowerCase();
  return weights[key] ?? 1.0;
}
