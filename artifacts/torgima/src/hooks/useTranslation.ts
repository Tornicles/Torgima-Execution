import {
  LANGUAGE,
  getCompletionLabel,
  getConditionLabel,
  getDifficultyLabel,
  getProjectDisplayName,
  getVerdictDisplay,
} from "@/lib/language";

export function useTranslation() {
  return {
    translateCondition: getConditionLabel,
    translateDifficulty: getDifficultyLabel,
    translateCompletion: getCompletionLabel,
    translateVerdict: getVerdictDisplay,
    translateProjectName: getProjectDisplayName,
    L: LANGUAGE,
  };
}
