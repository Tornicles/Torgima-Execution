import { create } from "zustand";
import { getExecutionActiveOrder } from "@/lib/torgima-api";
import type { MorningReportData } from "@/components/bhudhi/MorningReport";

export interface ActiveOrderSummary {
  id: string;
  title?: string;
  instruction?: string;
  status?: string;
}

interface ExecutionStore {
  activeOrder: ActiveOrderSummary | null;
  morningReport: MorningReportData | null;
  stateExplanation: string | null;
  isLoading: boolean;
  setActiveOrder: (order: ActiveOrderSummary | null) => void;
  setMorningReport: (report: MorningReportData | null) => void;
  setStateExplanation: (text: string | null) => void;
  refreshAll: () => Promise<void>;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  activeOrder: null,
  morningReport: null,
  stateExplanation: null,
  isLoading: false,
  setActiveOrder: (order) => set({ activeOrder: order }),
  setMorningReport: (report) => set({ morningReport: report }),
  setStateExplanation: (text) => set({ stateExplanation: text }),
  refreshAll: async () => {
    set({ isLoading: true });
    try {
      const data = (await getExecutionActiveOrder()) as {
        order?: ActiveOrderSummary | null;
        morningReport?: MorningReportData | null;
      };
      set({
        activeOrder: data.order ?? null,
        morningReport: data.morningReport ?? null,
      });
    } catch {
      /* no active order */
    } finally {
      set({ isLoading: false });
    }
  },
}));
