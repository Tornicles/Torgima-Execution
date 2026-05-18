/** Condition → tone / intensity maps (Prompt 5). Reads assigned condition only — never assigns. */

export type ConditionCode =
  | "nothingness"
  | "danger"
  | "urgency"
  | "stability"
  | "power"
  | "affluence"
  | "power_change";

export const CONDITION_TONE_MAP: Record<ConditionCode, string> = {
  nothingness: "gentle_directive",
  danger: "corrective_focused",
  urgency: "restorative_clear",
  stability: "optimizing_forward",
  power: "challenging_scaling",
  affluence: "leverage_maximizing",
  power_change: "transition_steady",
};

export const INTENSITY_MAP: Record<ConditionCode, "low" | "medium" | "high"> = {
  nothingness: "low",
  danger: "low",
  urgency: "medium",
  stability: "medium",
  power: "high",
  affluence: "high",
  power_change: "medium",
};

export const FOCUS_MAP: Record<ConditionCode, "stabilize" | "maintain" | "optimize" | "scale"> = {
  nothingness: "stabilize",
  danger: "stabilize",
  urgency: "maintain",
  stability: "optimize",
  power: "scale",
  affluence: "scale",
  power_change: "maintain",
};

export function normalizeCondition(raw: string | null | undefined): ConditionCode {
  const c = String(raw ?? "stability").toLowerCase().replace(/\s+/g, "_") as ConditionCode;
  if (c in CONDITION_TONE_MAP) return c;
  return "stability";
}
