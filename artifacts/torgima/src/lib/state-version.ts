/**
 * DOC 31 §3 — blueprint stateVersion tracking and STALE_STATE refresh flow.
 */

import { useCallback } from "react";
import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/store/dashboardStore";
import { invalidateDashboardProjection } from "@/lib/query-keys";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";

export const STALE_BANNER_MESSAGE =
  "Your project state has been updated. Refreshing...";

interface StaleStateStore {
  visible: boolean;
  refreshing: boolean;
  show: () => void;
  hide: () => void;
}

export const useStaleStateStore = create<StaleStateStore>((set) => ({
  visible: false,
  refreshing: false,
  show: () => set({ visible: true, refreshing: true }),
  hide: () => set({ visible: false, refreshing: false }),
}));

/** Subscribe to the current dashboard `stateVersion` (server truth only). */
export function useStateVersion(): number {
  return useDashboardStore((s) => s.stateVersion);
}

export function getStateVersion(): number {
  return useDashboardStore.getState().stateVersion;
}

/**
 * STALE_STATE handler:
 * 1. Show StaleBanner
 * 2. Invalidate + refetch dashboard projection
 * 3. Dismiss banner when refetch completes
 * Never treat as mutation success.
 */
export async function handleStaleStateConflict(queryClient: QueryClient): Promise<void> {
  const stale = useStaleStateStore.getState();
  stale.show();
  useDashboardStore.getState().invalidate();

  try {
    await invalidateDashboardProjection(queryClient);
    await queryClient.refetchQueries({
      queryKey: getGetDashboardStateQueryKey(),
      type: "active",
    });
  } finally {
    stale.hide();
  }
}

/** Hook for screens that need to trigger a manual stale refresh. */
export function useStaleStateRefresh(queryClient: QueryClient) {
  return useCallback(() => handleStaleStateConflict(queryClient), [queryClient]);
}

export function isStaleStateError(code: string | undefined): boolean {
  return code === "STALE_STATE";
}
