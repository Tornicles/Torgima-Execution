import type { ReactNode } from "react";
import { cards } from "@/design";

export function MetricStatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{children}</div>;
}

export function MetricStatCard({
  label,
  value,
  sub,
  icon,
  valueClassName = "text-gray-900",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className={`${cards.padded} flex flex-col`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
