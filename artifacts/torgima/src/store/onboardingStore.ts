/**
 * DOC 31 — onboarding flow UI state (goal draft, step, ids).
 * Complements onboardingFlowStore with DOC-named surface.
 */

import { create } from "zustand";
import { useOnboardingFlowStore } from "./onboardingFlowStore";

export type OnboardingStatus = "idle" | "draft" | "validating" | "selecting" | "complete";

interface OnboardingStore {
  step: number;
  blueprintId: string | null;
  validationId: string | null;
  status: OnboardingStatus;
  setStep: (n: number) => void;
  setBlueprintId: (id: string | null) => void;
  setValidationId: (id: string | null) => void;
  setStatus: (status: OnboardingStatus) => void;
  syncFromFlowStore: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  step: 0,
  blueprintId: null,
  validationId: null,
  status: "idle",
  setStep: (step) => set({ step }),
  setBlueprintId: (blueprintId) => set({ blueprintId }),
  setValidationId: (validationId) => set({ validationId }),
  setStatus: (status) => set({ status }),
  syncFromFlowStore: () => {
    const flow = useOnboardingFlowStore.getState();
    set({
      blueprintId: flow.blueprintId,
      validationId: flow.validationId,
      status: flow.validationId ? "validating" : flow.blueprintId ? "draft" : "idle",
    });
  },
}));

/** Keep DOC store aligned when flow store updates ids. */
useOnboardingFlowStore.subscribe((state) => {
  useOnboardingStore.setState({
    blueprintId: state.blueprintId,
    validationId: state.validationId,
    status: state.validationId ? "validating" : state.blueprintId ? "draft" : "idle",
  });
});
