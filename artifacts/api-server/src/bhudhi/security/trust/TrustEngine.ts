import type { SecurityInput, TrustLevel, TrustResult } from "../contracts/types.js";

function levelFromScore(score: number): TrustLevel {
  if (score < 0.2) return "UNTRUSTED";
  if (score < 0.45) return "LIMITED";
  if (score < 0.7) return "TRUSTED";
  if (score < 0.9) return "ELEVATED";
  return "SEALED";
}

export class TrustEngine {
  score(input: SecurityInput): TrustResult {
    const identity =
      typeof input.identity?.verified === "boolean" && input.identity.verified ? 0.25 : 0.1;
    const behavior =
      typeof input.identity?.anomalyScore === "number" ? 1 - Math.min(1, input.identity.anomalyScore) * 0.2 : 0.15;
    const history =
      typeof input.identity?.accountAge === "number"
        ? Math.min(0.2, input.identity.accountAge / 365 / 10)
        : 0.1;
    const governance =
      input.governance?.approved === true ? 0.2 : input.governance?.blocked === true ? 0 : 0.1;
    const reputation =
      typeof input.organization?.healthScore === "number"
        ? (input.organization.healthScore / 100) * 0.15
        : 0.08;

    const raw = identity + behavior + history + governance + reputation;
    const decay = input.identity?.trustDecayed === true ? 0.15 : 0;
    const trustScore = Math.max(0, Math.min(1, raw - decay));

    const reasons: string[] = [];
    if (identity < 0.2) reasons.push("Identity not fully verified");
    if (decay > 0) reasons.push("Trust decay applied");
    if (governance === 0) reasons.push("Governance not satisfied");
    if (reasons.length === 0) reasons.push("Trust within normal bounds");

    const expiration = new Date(Date.now() + 7 * 86400000).toISOString();

    return {
      trustScore,
      trustLevel: levelFromScore(trustScore),
      reasons,
      expiration,
    };
  }
}

export const trustEngine = new TrustEngine();
