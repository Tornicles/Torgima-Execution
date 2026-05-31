import type { ConditionKey } from "./tokens";

export const CONDITION_STYLES: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  nothingness: {
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    text: "text-gray-400",
    dot: "bg-gray-500",
  },
  danger: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-500",
  },
  urgency: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  stability: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  power: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    dot: "bg-indigo-500",
  },
  affluence: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    dot: "bg-purple-500",
  },
  powerChange: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  power_change: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
};

export function getConditionStyle(key?: string) {
  if (!key) return CONDITION_STYLES.nothingness;
  return CONDITION_STYLES[key] ?? CONDITION_STYLES.nothingness;
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  challenging: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  advanced: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  recovery: "text-amber-400 border-amber-500/30 bg-amber-500/10",
};

export function normalizeConditionKey(raw?: string | null): ConditionKey | "nothingness" {
  if (!raw) return "nothingness";
  const k = raw.toLowerCase().replace(/-/g, "_");
  if (k in CONDITION_STYLES) return k as ConditionKey;
  if (k === "powerchange") return "powerChange";
  return "nothingness";
}
