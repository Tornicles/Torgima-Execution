import { create } from "zustand";
import {
  DEFAULT_PRE_VALIDATION_DRAFT,
  loadPreValidationDraft,
  savePreValidationDraft,
  type PreValidationDraft,
} from "@/lib/pre-validation-draft";

const IDS_KEY = "torgima_onboarding_flow_ids_v1";

type FlowIds = { blueprintId: string | null; validationId: string | null };

function loadIds(): FlowIds {
  if (typeof sessionStorage === "undefined") return { blueprintId: null, validationId: null };
  try {
    const raw = sessionStorage.getItem(IDS_KEY);
    if (!raw) return { blueprintId: null, validationId: null };
    const p = JSON.parse(raw) as FlowIds;
    return {
      blueprintId: p.blueprintId ?? null,
      validationId: p.validationId ?? null,
    };
  } catch {
    return { blueprintId: null, validationId: null };
  }
}

function saveIds(ids: FlowIds) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

type OnboardingFlowState = {
  draft: PreValidationDraft;
  blueprintId: string | null;
  validationId: string | null;
  submitError: string | null;
  hydrate: () => void;
  patchDraft: (patch: Partial<PreValidationDraft>) => void;
  saveDraftToStorage: () => void;
  setBlueprintId: (id: string) => void;
  setValidationId: (id: string) => void;
  setSubmitError: (error: string | null) => void;
  clearSubmitError: () => void;
  resetFlow: () => void;
};

export const useOnboardingFlowStore = create<OnboardingFlowState>((set, get) => ({
  draft: loadPreValidationDraft(),
  ...loadIds(),
  submitError: null,

  hydrate() {
    set({ draft: loadPreValidationDraft(), ...loadIds(), submitError: null });
  },

  patchDraft(patch) {
    set((s) => {
      const draft = { ...s.draft, ...patch };
      savePreValidationDraft(draft);
      return { draft };
    });
  },

  saveDraftToStorage() {
    savePreValidationDraft(get().draft);
  },

  setBlueprintId(blueprintId) {
    const ids = { ...loadIds(), blueprintId };
    saveIds(ids);
    set({ blueprintId });
  },

  setValidationId(validationId) {
    const ids = { blueprintId: get().blueprintId, validationId };
    saveIds(ids);
    set({ validationId });
    if (validationId && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("torgima_validation_results", validationId);
    }
  },

  setSubmitError(submitError) {
    set({ submitError });
  },

  clearSubmitError() {
    set({ submitError: null });
  },

  resetFlow() {
    const draft = { ...DEFAULT_PRE_VALIDATION_DRAFT };
    savePreValidationDraft(draft);
    saveIds({ blueprintId: null, validationId: null });
    set({ draft, blueprintId: null, validationId: null, submitError: null });
  },
}));
