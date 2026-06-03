/**
 * DOC 31 — dashboard projection cache + invalidation bridge to React Query.
 */

import { create } from "zustand";
import type { DashboardProjection } from "@/lib/dashboard-types";

type InvalidateFn = (() => void) | null;

let registeredInvalidate: InvalidateFn = null;

export function registerDashboardInvalidate(fn: InvalidateFn): void {
  registeredInvalidate = fn;
}

interface DashboardStore {
  projection: DashboardProjection | null;
  stateVersion: number;
  pendingSync: boolean;
  lastFetchedAt: Date | null;
  setProjection: (p: DashboardProjection | null) => void;
  setPending: (v: boolean) => void;
  setStateVersion: (v: number) => void;
  invalidate: () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  projection: null,
  stateVersion: 0,
  pendingSync: false,
  lastFetchedAt: null,
  setProjection: (projection) =>
    set({
      projection,
      stateVersion: typeof projection?.stateVersion === "number" ? projection.stateVersion : 0,
      pendingSync: Boolean(projection?.pendingSync),
      lastFetchedAt: new Date(),
    }),
  setPending: (pendingSync) => set({ pendingSync }),
  setStateVersion: (stateVersion) => set({ stateVersion }),
  invalidate: () => {
    set({ pendingSync: true });
    registeredInvalidate?.();
  },
}));

/** Read state version for mutations without subscribing. */
export function getDashboardStateVersion(): number {
  return useDashboardStore.getState().stateVersion;
}
