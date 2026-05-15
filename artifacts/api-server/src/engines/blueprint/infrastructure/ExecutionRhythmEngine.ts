import type { BlueprintTier } from "./blueprint-types.js";

export interface ExecutionRhythm {
  cadence: "daily_light" | "daily_structured" | "adaptive";
  intensity: "light" | "steady" | "focused" | "intense";
  recoveryWindowHours: number;
}

export function deriveExecutionRhythm(
  tier: BlueprintTier,
  commitmentLevel: string | null,
): ExecutionRhythm {
  const intensity =
    commitmentLevel === "full" ? "intense"
    : commitmentLevel === "high" ? "focused"
    : commitmentLevel === "low" ? "light"
    : "steady";

  return {
    cadence: tier === "starter" ? "daily_light" : tier === "growth" ? "daily_structured" : "adaptive",
    intensity,
    recoveryWindowHours: tier === "ultimate" ? 12 : 24,
  };
}
