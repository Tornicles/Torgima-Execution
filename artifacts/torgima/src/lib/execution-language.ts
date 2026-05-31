/** Torgima execution language — client-side mirror of server substitutions (Prompt 6). */

import { CONDITION_STYLES } from "@workspace/design-system";

export const FORBIDDEN_PATTERNS = [
  /\bgreat job\b/i,
  /\bcongratulations\b/i,
  /\byou're doing amazing\b/i,
  /\bto-do\b/i,
  /\bchecklist\b/i,
];

export const LANGUAGE_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/\bgreat job\b/gi, "execution continuity maintained"],
  [/\bcongratulations\b/gi, "milestone reached"],
  [/\bto-do\b/gi, "Order"],
  [/\bchecklist\b/gi, "execution sequence"],
  [/\btasks\b/gi, "Orders"],
  [/\btask\b/gi, "Order"],
  [/\bplans\b/gi, "Blueprints"],
  [/\bplan\b/gi, "Blueprint"],
  [/\bscores\b/gi, "Signals"],
  [/\bscore\b/gi, "Signal"],
];

export function applyExecutionLanguage(text: string): string {
  let out = text;
  for (const [pattern, replacement] of LANGUAGE_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function auditForbiddenWords(source: string): string[] {
  const hits: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) hits.push(pattern.source);
  }
  if (/\bplan\b/i.test(source) && !/\bBlueprint\b/i.test(source)) {
    hits.push("\\bplan\\b (standalone)");
  }
  return hits;
}

export const CONDITION_LABELS: Record<string, string> = {
  nothingness: "Nothingness",
  danger: "Danger",
  urgency: "Urgency",
  stability: "Stability",
  power: "Power",
  affluence: "Affluence",
  power_change: "PowerChange",
};

/** Manifesto-aligned condition colors — shared with marketing site */
export const CONDITION_COLORS: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  nothingness: {
    bg: CONDITION_STYLES.nothingness.bg,
    text: CONDITION_STYLES.nothingness.text,
    ring: CONDITION_STYLES.nothingness.border,
  },
  danger: {
    bg: CONDITION_STYLES.danger.bg,
    text: CONDITION_STYLES.danger.text,
    ring: CONDITION_STYLES.danger.border,
  },
  urgency: {
    bg: CONDITION_STYLES.urgency.bg,
    text: CONDITION_STYLES.urgency.text,
    ring: CONDITION_STYLES.urgency.border,
  },
  stability: {
    bg: CONDITION_STYLES.stability.bg,
    text: CONDITION_STYLES.stability.text,
    ring: CONDITION_STYLES.stability.border,
  },
  power: {
    bg: CONDITION_STYLES.power.bg,
    text: CONDITION_STYLES.power.text,
    ring: CONDITION_STYLES.power.border,
  },
  affluence: {
    bg: CONDITION_STYLES.affluence.bg,
    text: CONDITION_STYLES.affluence.text,
    ring: CONDITION_STYLES.affluence.border,
  },
  power_change: {
    bg: CONDITION_STYLES.power_change.bg,
    text: CONDITION_STYLES.power_change.text,
    ring: CONDITION_STYLES.power_change.border,
  },
};

export function signalLevelLabel(value: number): {
  label: string;
  color: string;
} {
  if (value <= 0.2) return { label: "Critical", color: "text-red-400" };
  if (value <= 0.4) return { label: "Low", color: "text-amber-400" };
  if (value <= 0.6) return { label: "Steady", color: "text-emerald-400" };
  if (value <= 0.8) return { label: "Good", color: "text-indigo-400" };
  return { label: "Strong", color: "text-primary-bright" };
}

export { getConditionLabel } from "./language";
