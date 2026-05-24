import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
  accentClass = "text-emerald-600",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold ${accentClass}`}>{value}</p>
          {sub && <div className="mt-1 text-sm text-gray-600">{sub}</div>}
        </div>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
    </div>
  );
}
