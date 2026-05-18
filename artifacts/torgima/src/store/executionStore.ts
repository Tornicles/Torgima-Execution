import { create } from "zustand";
import { API_BASE_URL } from "@/lib/api-base";
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
    if (!API_BASE_URL) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/execution/active-order`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: {
          order?: ActiveOrderSummary | null;
          morningReport?: MorningReportData | null;
        };
      };
      if (json.ok && json.data) {
        set({
          activeOrder: json.data.order ?? null,
          morningReport: json.data.morningReport ?? null,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
