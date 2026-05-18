import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { signalLevelLabel } from "@/lib/execution-language";
import { cn } from "@/lib/utils";

export interface SignalRecord {
  completionRate?: number;
  scoreAverage?: number;
  momentum?: number;
  consistency?: number;
}

type Trajectory = Record<string, "rising" | "stable" | "declining" | string>;

const SIGNAL_KEYS = [
  { key: "completionRate", label: "Completion rate" },
  { key: "scoreAverage", label: "Signal average" },
  { key: "momentum", label: "Momentum" },
  { key: "consistency", label: "Consistency" },
] as const;

function trendIcon(trend?: string) {
  if (trend === "rising") return <TrendingUp className="w-3.5 h-3.5 text-green-600" />;
  if (trend === "declining") return <TrendingDown className="w-3.5 h-3.5 text-red-600" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

export function SignalDisplay({
  signals,
  trajectory,
  compact = false,
}: {
  signals: SignalRecord;
  trajectory?: Trajectory;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact ? "" : "rounded-2xl border border-gray-200 p-5 bg-white")}>
      {SIGNAL_KEYS.map(({ key, label }) => {
        const raw = signals[key] ?? 0;
        const pct = Math.round(Math.min(1, Math.max(0, raw)) * 100);
        const level = signalLevelLabel(raw);
        const trend = trajectory?.[key];
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">{label}</span>
              <div className="flex items-center gap-1.5">
                {trendIcon(trend)}
                <span className={cn("font-semibold", level.color)}>{level.label}</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
