type DashboardState = Record<string, any>;
import { create } from "zustand";

interface BlueprintStore {
  activeBlueprintId: string | null;
  setActiveBlueprintId: (id: string | null) => void;
  /** Last synced `/api/state/dashboard` payload (polling hook keeps this warm). */
  dashboardProjection: DashboardState | null;
  setDashboardProjection: (projection: DashboardState | null) => void;
  lastStateVersion: number;
  setLastStateVersion: (v: number) => void;
}

export const useBlueprintStore = create<BlueprintStore>((set) => ({
  activeBlueprintId: null,
  setActiveBlueprintId: (id) => set({ activeBlueprintId: id }),
  dashboardProjection: null,
  setDashboardProjection: (dashboardProjection) => set({ dashboardProjection }),
  lastStateVersion: 0,
  setLastStateVersion: (lastStateVersion) => set({ lastStateVersion }),
}));
