import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey, getGetDashboardStateQueryOptions } from "@workspace/api-client-react";
import { useBlueprintStore } from "@/store/blueprintStore";
import { registerDashboardInvalidate, useDashboardStore } from "@/store/dashboardStore";
import { invalidateDashboardProjection } from "@/lib/query-keys";
import { getDashboardUiState, toDashboardProjection, type DashboardProjection } from "@/lib/dashboard-types";

const DEFAULT_POLL_MS = 3000;
/** DOC 33 — poll every 5s while task guarantee is pending. */
const PENDING_SYNC_POLL_MS = 5_000;

export const dashboardQueryKey = getGetDashboardStateQueryKey();

/**
 * DOC 31 — canonical dashboard projection from server only.
 * Polls faster while pendingSync; exposes invalidate() after every mutation.
 */
export function useDashboardProjection() {
  const queryClient = useQueryClient();
  const setBlueprintProjection = useBlueprintStore((s) => s.setDashboardProjection);
  const setActiveBlueprintId = useBlueprintStore((s) => s.setActiveBlueprintId);
  const setLastStateVersion = useBlueprintStore((s) => s.setLastStateVersion);
  const setDashboardStoreProjection = useDashboardStore((s) => s.setProjection);
  const setPending = useDashboardStore((s) => s.setPending);
  const storePendingSync = useDashboardStore((s) => s.pendingSync);
  const stateVersion = useDashboardStore((s) => s.stateVersion);

  const invalidate = useCallback(() => {
    setPending(true);
    void invalidateDashboardProjection(queryClient);
  }, [queryClient, setPending]);

  useEffect(() => {
    registerDashboardInvalidate(invalidate);
    return () => registerDashboardInvalidate(null);
  }, [invalidate]);

  const query = useQuery({
    ...getGetDashboardStateQueryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const data = q.state.data ? toDashboardProjection(q.state.data) : undefined;
      const ui = getDashboardUiState(data ?? null);
      if (ui === "PENDING_SYNC" || data?.pendingSync || storePendingSync) {
        return PENDING_SYNC_POLL_MS;
      }
      return DEFAULT_POLL_MS;
    },
    refetchIntervalInBackground: true,
    staleTime: 2000,
  });

  const projection = useMemo(
    () => (query.data ? toDashboardProjection(query.data) : null),
    [query.data],
  );

  const pendingSync = useMemo(() => {
    if (!projection) return storePendingSync;
    const ui = getDashboardUiState(projection);
    return Boolean(projection.pendingSync) || ui === "PENDING_SYNC";
  }, [projection, storePendingSync]);

  useEffect(() => {
    if (!query.data) return;
    const data = toDashboardProjection(query.data);
    setBlueprintProjection(data);
    setDashboardStoreProjection(data);
    setActiveBlueprintId((data.activeBlueprint as { id?: string } | null)?.id ?? null);
    if (typeof data.stateVersion === "number") {
      setLastStateVersion(data.stateVersion);
    }
    if (!data.pendingSync && getDashboardUiState(data) !== "PENDING_SYNC") {
      setPending(false);
    }
  }, [
    query.data,
    setBlueprintProjection,
    setDashboardStoreProjection,
    setActiveBlueprintId,
    setLastStateVersion,
    setPending,
  ]);

  return {
    ...query,
    projection,
    stateVersion: projection?.stateVersion ?? stateVersion,
    pendingSync,
    invalidate,
    lastFetchedAt: query.dataUpdatedAt,
  };
}

export type UseDashboardProjectionResult = ReturnType<typeof useDashboardProjection> & {
  projection: DashboardProjection | null;
};
