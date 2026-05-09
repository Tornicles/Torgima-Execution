import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey, getGetDashboardStateQueryOptions } from "@workspace/api-client-react";
import { useBlueprintStore } from "@/store/blueprintStore";

const DASH_POLL_MS = 5000;

export const dashboardQueryKey = getGetDashboardStateQueryKey();

/**
 * Canonical dashboard projection: polls every ~5s and mirrors into `blueprintStore`.
 */
export function useDashboardProjection() {
  const setProjection = useBlueprintStore((s) => s.setDashboardProjection);
  const setActiveBlueprintId = useBlueprintStore((s) => s.setActiveBlueprintId);

  const query = useQuery({
    ...getGetDashboardStateQueryOptions(),
    refetchInterval: DASH_POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 2500,
  });

  useEffect(() => {
    if (query.data) {
      setProjection(query.data);
      setActiveBlueprintId(query.data.activeBlueprint?.id ?? null);
    }
  }, [query.data, setProjection, setActiveBlueprintId]);

  return query;
}
