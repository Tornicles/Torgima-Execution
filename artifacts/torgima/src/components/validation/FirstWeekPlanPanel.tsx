export function FirstWeekPlanPanel({ erector }: { erector?: Record<string, unknown> }) {
  const raw = erector?.["first_week_plan"] ?? erector;
  const plans = Array.isArray((raw as { plans?: unknown[] })?.plans)
    ? ((raw as { plans: Array<Record<string, unknown>> }).plans)
    : Array.isArray(raw)
      ? (raw as Array<Record<string, unknown>>)
      : [];

  const days = (raw as { days?: Array<{ day: number; actions?: Array<{ title?: string }> }> })?.days;
  const items =
    plans.length > 0
      ? plans.map((p, i) => ({
          title: String(p.title ?? `Day ${i + 1}`),
          action: String(p.action ?? p.description ?? ""),
        }))
      : (days ?? []).map((d) => ({
          title: d.actions?.[0]?.title ?? `Day ${d.day}`,
          action: "Smoke test task",
        }));

  if (items.length === 0) return null;

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">First week execution plan</p>
      <p className="text-sm text-gray-600">
        These seven smoke-test tasks seed your queue at launch before the normal execution loop runs.
      </p>
      <ol className="space-y-2 list-decimal list-inside text-sm text-gray-800">
        {items.slice(0, 7).map((item, index) => (
          <li key={index}>
            <span className="font-medium">{item.title}</span>
            {item.action ? <span className="text-gray-500"> — {item.action}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
