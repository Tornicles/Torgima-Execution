type Readiness = string | undefined;

const LABELS: Record<string, { label: string; color: string }> = {
  not_ready: { label: "Not Ready", color: "bg-gray-200 text-gray-700" },
  partial: { label: "Analyzing…", color: "bg-blue-100 text-blue-800" },
  ready_proceed: { label: "Ready to Proceed", color: "bg-green-100 text-green-800" },
  ready_with_adjustment: { label: "Ready with Adjustment", color: "bg-amber-100 text-amber-900" },
  blocked_pivot: { label: "Blocked — Pivot Required", color: "bg-red-100 text-red-800" },
};

export function ReadinessIndicator({ readiness }: { readiness?: Readiness }) {
  const key = readiness ?? "partial";
  const cfg = LABELS[key] ?? LABELS.partial!;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
