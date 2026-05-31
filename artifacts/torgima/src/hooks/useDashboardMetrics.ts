import { useMemo } from "react";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { toDashboardProjection } from "@/lib/dashboard-types";
import { getConditionLabel } from "@/lib/language";
import type { Order } from "@workspace/api-client-react";

export function useDashboardMetrics() {
  const { data, isLoading, isError, refetch } = useDashboardProjection();
  const projection = data ? toDashboardProjection(data) : null;

  return useMemo(() => {
    const signals = projection?.signals;
    const conditionRaw = (
      (projection?.conditionDetail as { condition?: string } | undefined)?.condition ??
      projection?.activeBlueprint?.currentCondition ??
      signals?.condition ??
      "stability"
    ).toString();

    const completionRate = Math.round((signals?.consistency ?? 0) * 100);
    const momentum = signals?.momentum ?? 0;
    const dailyScore = Number(((signals?.velocity ?? 0) * 10).toFixed(1));
    const streak = projection?.streakDays ?? signals?.streak ?? 0;
    const orders = (projection?.activeOrders ?? []) as Order[];

    const journeyDay = (() => {
      const bp = projection?.activeBlueprint;
      if (!bp?.activatedAt) return bp?.phase ?? 1;
      const start = new Date(bp.activatedAt).getTime();
      return Math.max(1, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)) + 1);
    })();

    return {
      projection,
      isLoading,
      isError,
      refetch,
      conditionLabel: getConditionLabel(conditionRaw).label,
      conditionDisplay: getConditionLabel(conditionRaw),
      conditionRaw,
      completionRate,
      momentum,
      dailyScore,
      streak,
      orders,
      journeyDay,
      blueprint: projection?.activeBlueprint,
      displayName:
        projection?.user?.displayName ?? projection?.user?.email?.split("@")[0] ?? "Builder",
    };
  }, [projection, isLoading, isError, refetch]);
}
