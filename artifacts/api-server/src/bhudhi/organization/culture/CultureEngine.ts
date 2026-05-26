import type { CultureProfile, OrgInput } from "../contracts/types.js";

export class CultureEngine {
  measure(input: OrgInput): CultureProfile {
    const identity = input.identity ?? {};
    const feedback = (input.execution ?? {}) as Record<string, unknown>;

    const trust = typeof identity.confidence === "number" ? identity.confidence * 0.9 : 0.55;
    const clarity = input.strategy?.vision ? 0.75 : 0.45;
    const ownership = (input.projects ?? []).some((p) => p.ownerId) ? 0.7 : 0.4;
    const accountability = input.signals?.global === "power" ? 0.72 : 0.5;
    const burnout =
      (identity as Record<string, unknown>).burnout || feedback.burnout ? 0.75 : 0.2;
    const cooperation = (input.users ?? []).length > 1 ? 0.68 : 0.45;

    const avg = (trust + clarity + ownership + accountability + (1 - burnout) + cooperation) / 6;
    let profile = "Balanced";
    if (burnout > 0.6) profile = "Recovery needed";
    else if (trust > 0.7 && cooperation > 0.65) profile = "High-trust collaborative";
    else if (ownership > 0.65) profile = "Ownership-driven";

    return { trust, clarity, ownership, accountability, burnout, cooperation, profile };
  }
}

export const cultureEngine = new CultureEngine();
