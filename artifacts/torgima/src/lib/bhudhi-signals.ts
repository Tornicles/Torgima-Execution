/** Global signal colors and labels (BHUDHI PROMPT 11). */

export const GLOBAL_SIGNALS = [
  "nothingness",
  "danger",
  "urgency",
  "stability",
  "power",
  "affluence",
  "powerchange",
] as const;

export type GlobalSignal = (typeof GLOBAL_SIGNALS)[number];

const SIGNAL_COLORS: Record<string, string> = {
  nothingness: "bg-gray-200 text-gray-800",
  danger: "bg-red-500 text-white",
  urgency: "bg-orange-500 text-white",
  stability: "bg-blue-500 text-white",
  power: "bg-green-500 text-white",
  affluence: "bg-emerald-600 text-white",
  powerchange: "bg-purple-500 text-white",
};

const SIGNAL_LABELS: Record<string, string> = {
  nothingness: "No execution",
  danger: "Danger",
  urgency: "Urgent",
  stability: "Stable",
  power: "Strong",
  affluence: "Excellent",
  powerchange: "Transitioning",
};

export function getSignalColor(signal: string | null | undefined): string {
  return SIGNAL_COLORS[signal ?? ""] ?? "bg-gray-500 text-white";
}

export function getSignalLabel(signal: string | null | undefined): string {
  return SIGNAL_LABELS[signal ?? ""] ?? signal ?? "Unknown";
}

export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence == null || Number.isNaN(confidence)) return "—";
  const pct = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(pct)}%`;
}
