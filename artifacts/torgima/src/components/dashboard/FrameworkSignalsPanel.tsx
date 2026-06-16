import { useEffect, useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { BLUEPRINT_LABELS } from "@/lib/language-map";

type SignalCard = {
  value: number;
  momentum: number;
  change?: number;
  trend: string;
  statusLabel: string;
  confidence: number;
  detailLine?: string;
  valueHistory?: Record<string, number>;
};

type FrameworkPayload = {
  production: SignalCard;
  operations: SignalCard;
  growth: SignalCard;
  scale: SignalCard;
  feedbackCount?: number;
  overallConfidence?: number;
  calculatedAt?: string;
};

type ConditionDisplay = {
  label: string;
  emoji: string;
  condition: string;
};

type SignalsResponse = {
  frameworkSignals: FrameworkPayload | null;
  conditionDisplay?: ConditionDisplay | null;
};

function barWidth(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function trendArrow(trend: string, momentum: number): string {
  if (trend === "improving" || momentum > 0.02) return "↑";
  if (trend === "declining" || momentum < -0.02) return "↓";
  return "→";
}

function SignalRow({ label, sig }: { label: string; sig: SignalCard }) {
  const delta = sig.change ?? sig.momentum;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {sig.value.toFixed(2)} {trendArrow(sig.trend, sig.momentum)}{" "}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: barWidth(sig.value) }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {sig.statusLabel}
        {sig.detailLine ? ` · ${sig.detailLine}` : ""}
      </p>
    </div>
  );
}

export function FrameworkSignalsPanel({ blueprintId }: { blueprintId?: string | null }) {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blueprintId) return;
    setLoading(true);
    void apiFetchEnvelope<SignalsResponse>(
      `/api/signals/current?blueprintId=${encodeURIComponent(blueprintId)}`,
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setData(res.data);
    });
  }, [blueprintId]);

  if (!blueprintId) return null;
  if (loading && !data?.frameworkSignals) {
    return <p className="text-sm text-muted-foreground">Loading {BLUEPRINT_LABELS.signals.toLowerCase()}…</p>;
  }

  const framework = data?.frameworkSignals;
  if (!framework) return null;

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Signal intelligence ({BLUEPRINT_LABELS.signals})
        </p>
        {data?.conditionDisplay && (
          <span className="text-[10px] text-muted-foreground">
            {data.conditionDisplay.emoji} {data.conditionDisplay.label}
          </span>
        )}
      </div>
      <SignalRow label="Production" sig={framework.production} />
      <SignalRow label="Operations" sig={framework.operations} />
      <SignalRow label="Growth" sig={framework.growth} />
      <SignalRow label="Scale" sig={framework.scale} />
      <p className="text-[10px] text-muted-foreground">
        Based on last {framework.feedbackCount ?? 10} feedback entries
        {framework.overallConfidence != null &&
          ` · ${Math.round(framework.overallConfidence * 100)}% confidence`}
        {" · "}updates after each submission
      </p>
    </section>
  );
}
