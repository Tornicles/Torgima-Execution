import { create } from "zustand";
import {
  DEFAULT_PRE_VALIDATION_DRAFT,
  loadPreValidationDraft,
  savePreValidationDraft,
  type PreValidationDraft,
} from "@/lib/pre-validation-draft";
import type {
  OnboardingWizardStatus,
  StructuredGoalDraft,
} from "@/lib/onboarding-doc32";

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
  /** DOC 32 — 0 = welcome, 1–8 mapped in flow pages */
  welcomeSeen: boolean;
  wizardStatus: OnboardingWizardStatus;
  structuredGoal: StructuredGoalDraft | null;
  clarificationIndex: number;
  clarificationAnswers: Record<string, string>;
  tierConfigured: boolean;
  hydrate: () => void;
  patchDraft: (patch: Partial<PreValidationDraft>) => void;
  saveDraftToStorage: () => void;
  setWelcomeSeen: (seen: boolean) => void;
  setWizardStatus: (status: OnboardingWizardStatus) => void;
  setStructuredGoal: (goal: StructuredGoalDraft | null) => void;
  setClarificationIndex: (index: number) => void;
  setClarificationAnswer: (field: string, value: string) => void;
  setTierConfigured: (configured: boolean) => void;
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
  welcomeSeen: false,
  wizardStatus: "EMPTY",
  structuredGoal: null,
  clarificationIndex: 0,
  clarificationAnswers: {},
  tierConfigured: false,

  hydrate() {
    set({
      draft: loadPreValidationDraft(),
      ...loadIds(),
      submitError: null,
    });
  },

  setWelcomeSeen(welcomeSeen) {
    set({ welcomeSeen });
  },

  setWizardStatus(wizardStatus) {
    set({ wizardStatus });
  },

  setStructuredGoal(structuredGoal) {
    set({ structuredGoal });
  },

  setClarificationIndex(clarificationIndex) {
    set({ clarificationIndex });
  },

  setClarificationAnswer(field, value) {
    set((s) => ({
      clarificationAnswers: { ...s.clarificationAnswers, [field]: value },
    }));
  },

  setTierConfigured(tierConfigured) {
    set({ tierConfigured });
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
    set({
      draft,
      blueprintId: null,
      validationId: null,
      submitError: null,
      welcomeSeen: false,
      wizardStatus: "EMPTY",
      structuredGoal: null,
      clarificationIndex: 0,
      clarificationAnswers: {},
      tierConfigured: false,
    });
  },
}));
