import { create } from "zustand";
import { api } from "../services/apiClient";

export type TodayTask = {
  id: string;
  title: string;
  priority: number;
  dueTime: string | null;
  status: string;
};

export type WidgetData = {
  todayTask: TodayTask | null;
  todayPrinciple?: { id: string; title: string } | null;
  userLevel: number;
  userXP: number;
  currentStreak: { execution: number; principles: number; content: number };
  badgeCount: number;
  activeBlueprintId?: string | null;
};

type TaskState = {
  widget: WidgetData | null;
  summary: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  loadDashboard: () => Promise<void>;
};

export const useTaskStore = create<TaskState>((set) => ({
  widget: null,
  summary: null,
  loading: false,
  error: null,

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const [widgetRes, summaryRes] = await Promise.all([
        api.get<{ widget: WidgetData }>("/mobile/widget-data"),
        api.get<{ summary: Record<string, unknown> }>("/mobile/dashboard-summary"),
      ]);
      set({
        widget: widgetRes.widget,
        summary: summaryRes.summary,
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load",
        loading: false,
      });
    }
  },
}));
