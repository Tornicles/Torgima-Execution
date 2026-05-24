import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { spacing } from "@/design";

export function DashboardPageLayout({
  title,
  subtitle,
  headerRight,
  stats,
  children,
  rightRail,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  stats?: ReactNode;
  children: ReactNode;
  rightRail?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`min-h-full bg-[#f9fafb] ${spacing.pageX} ${spacing.pageY} max-w-[1600px] mx-auto`}>
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <Info className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">{subtitle}</p>}
        </div>
        {headerRight && <div className="flex flex-wrap items-center gap-2">{headerRight}</div>}
      </header>

      {stats && <div className="mb-6">{stats}</div>}

      <div className={rightRail ? "grid lg:grid-cols-3 gap-6" : ""}>
        <div className={rightRail ? "lg:col-span-2 space-y-6" : "space-y-6"}>{children}</div>
        {rightRail && <div className="space-y-4">{rightRail}</div>}
      </div>

      {footer && <div className="mt-8">{footer}</div>}
    </div>
  );
}
