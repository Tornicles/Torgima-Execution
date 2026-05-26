import { randomUUID } from "node:crypto";
import type { ExperimentGroup, Hypothesis } from "../contracts/types.js";

const VARIANT_KEYS = ["control", "variant_a", "variant_b", "variant_c"] as const;

export class ExperimentDesign {
  /** No overlapping experiments — caller must check active set externally. */
  design(hypothesis: Hypothesis, params: {
    durationDays?: number;
    sampleSize?: number;
    confidence?: number;
    metrics?: string[];
    budget?: number;
  }): {
    groups: ExperimentGroup[];
    duration: number;
    sample: number;
    confidence: number;
    metrics: string[];
    budget: number;
  } {
    const weights = [0.25, 0.25, 0.25, 0.25];
    const groups: ExperimentGroup[] = VARIANT_KEYS.map((key, i) => ({
      id: randomUUID(),
      groupKey: key,
      label: key === "control" ? "Control (baseline)" : `Variant ${key.replace("variant_", "").toUpperCase()}`,
      allocationWeight: weights[i]!,
    }));

    return {
      groups,
      duration: params.durationDays ?? 7,
      sample: params.sampleSize ?? 100,
      confidence: params.confidence ?? 0.95,
      metrics: params.metrics ?? ["impact", "quality", "speed"],
      budget: params.budget ?? 1,
    };
  }
}

export const experimentDesign = new ExperimentDesign();
