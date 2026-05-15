import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey, getGetDashboardStateQueryOptions } from "@workspace/api-client-react";
import { useBlueprintStore } from "@/store/blueprintStore";
import { getDashboardUiState, toDashboardProjection, type DashboardProjection } from "@/lib/dashboard-types";

const DEFAULT_POLL_MS = 5000;
const FAST_POLL_MS = 1500;

export const dashboardQueryKey = getGetDashboardStateQueryKey();

/**
 * Canonical dashboard projection: polls server state; accelerates while pending task sync.
 */
export function useDashboardProjection() {
  const setProjection = useBlueprintStore((s) => s.setDashboardProjection);
  const setActiveBlueprintId = useBlueprintStore((s) => s.setActiveBlueprintId);
  const setLastStateVersion = useBlueprintStore((s) => s.setLastStateVersion);

  const query = useQuery({
    ...getGetDashboardStateQueryOptions(),
    refetchInterval: (q) => {
      const data = q.state.data ? toDashboardProjection(q.state.data) : undefined;
      const ui = getDashboardUiState(data ?? null);
      if (ui === "PENDING_SYNC" || data?.pendingSync) return FAST_POLL_MS;
      return DEFAULT_POLL_MS;
    },
    refetchIntervalInBackground: true,
    staleTime: 2000,
  });

  useEffect(() => {
    if (query.data) {
      const data = toDashboardProjection(query.data);
      setProjection(data);
      setActiveBlueprintId((data.activeBlueprint as { id?: string } | null)?.id ?? null);
      if (typeof data.stateVersion === "number") {
        setLastStateVersion(data.stateVersion);
      }
    }
  }, [query.data, setProjection, setActiveBlueprintId, setLastStateVersion]);

  return query;
}
