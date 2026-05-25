import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { spacing } from "@/design";
import { PageHeaderActions } from "@/components/design-system/PageHeaderActions";

export function DashboardPageLayout({
  title,
  subtitle,
  headerRight,
  showHeaderActions = true,
  stats,
  children,
  rightRail,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  showHeaderActions?: boolean;
  stats?: ReactNode;
  children: ReactNode;
  rightRail?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`min-h-full bg-white ${spacing.pageX} ${spacing.pageY} max-w-[1600px] mx-auto`}>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 min-h-14 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <Info className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerRight}
          {showHeaderActions && <PageHeaderActions />}
        </div>
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
