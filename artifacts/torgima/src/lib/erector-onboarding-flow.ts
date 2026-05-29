export type ErectorOnboardingStep =
  | "raw_goal"
  | "goal_options"
  | "raw_purpose"
  | "purpose_options"
  | "context"
  | "validating"
  | "results";

export type ErectorOnboardingState = {
  step: ErectorOnboardingStep;
  rawGoal: string;
  goalOptions: string[];
  selectedGoal: string;
  rawPurpose: string;
  purposeOptions: string[];
  selectedPurpose: string;
};

export const ERECTOR_ONBOARDING_STORAGE_KEY = "torgima_erector_onboarding_v1";

export function canAdvanceFromStep(step: ErectorOnboardingStep, state: ErectorOnboardingState): boolean {
  switch (step) {
    case "raw_goal":
      return state.goalOptions.length === 3;
    case "goal_options":
      return Boolean(state.selectedGoal.trim());
    case "raw_purpose":
      return state.purposeOptions.length === 3;
    case "purpose_options":
      return Boolean(state.selectedPurpose.trim());
    case "context":
      return Boolean(state.selectedGoal.trim() && state.selectedPurpose.trim());
    default:
      return false;
  }
}

export function nextStepAfter(
  step: ErectorOnboardingStep,
  state: ErectorOnboardingState,
): ErectorOnboardingStep | null {
  if (!canAdvanceFromStep(step, state)) return null;
  switch (step) {
    case "raw_goal":
      return "goal_options";
    case "goal_options":
      return "raw_purpose";
    case "raw_purpose":
      return "purpose_options";
    case "purpose_options":
      return "context";
    default:
      return null;
  }
}

export function loadPersistedErectorOnboarding(): ErectorOnboardingState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ERECTOR_ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErectorOnboardingState;
    if (!parsed?.step) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistErectorOnboarding(state: ErectorOnboardingState): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ERECTOR_ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}

export function initialErectorOnboardingState(): ErectorOnboardingState {
  return {
    step: "raw_goal",
    rawGoal: "",
    goalOptions: [],
    selectedGoal: "",
    rawPurpose: "",
    purposeOptions: [],
    selectedPurpose: "",
  };
}
