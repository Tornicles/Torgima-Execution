export type SignalStripData = {
  completionRate?: number;
  weightedScore?: number;
  momentum?: number;
  direction?: string;
};

export function SignalStrip({ signals }: { signals: SignalStripData }) {
  const stats = [
    {
      label: "Tasks Completed",
      value: `${Math.round((signals.completionRate ?? 0) * 100)}%`,
      color: "text-emerald-400",
    },
    {
      label: "Execution Quality",
      value: `${(signals.weightedScore ?? 0).toFixed(1)}/10`,
      color: "text-primary-bright",
    },
    {
      label: "Day Streak",
      value: `${signals.momentum ?? 0}d`,
      color: "text-amber-400",
    },
    {
      label: "Direction",
      value: signals.direction ?? "—",
      color: "text-text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-dark-card border border-dark-border rounded-2xl p-5">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className={`font-heading font-black text-2xl mb-1 ${stat.color}`}>{stat.value}</div>
          <div className="text-text-muted text-xs font-body">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
