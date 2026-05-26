/** Torgima execution language — client-side mirror of server substitutions (Prompt 6). */

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

export const CONDITION_COLORS: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  nothingness: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-300" },
  danger: { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-400" },
  urgency: { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-400" },
  stability: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-400" },
  power: { bg: "bg-blue-100", text: "text-blue-800", ring: "ring-blue-400" },
  affluence: { bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-400" },
  power_change: { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-400" },
};

export function signalLevelLabel(value: number): {
  label: string;
  color: string;
} {
  if (value <= 0.2) return { label: "Critical", color: "text-red-600" };
  if (value <= 0.4) return { label: "Low", color: "text-orange-600" };
  if (value <= 0.6) return { label: "Steady", color: "text-yellow-700" };
  if (value <= 0.8) return { label: "Good", color: "text-blue-600" };
  return { label: "Strong", color: "text-green-600" };
}
