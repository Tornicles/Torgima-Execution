import { directionLabel } from "@/components/validation/validation-results-dashboard-model";
import { buildViewModel } from "@/components/validation/validation-results-helpers";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import type { PathKey } from "@/components/validation/PathPanels";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { formatDisplayDate, weeklyCommitmentContextLabel, loadPreValidationDraft } from "@/lib/pre-validation-draft";

export type ValidationLaunchContext = {
  validationId: string;
  blueprintId: string;
  selectedPath: PathKey;
  selectedTier?: TierId;
  goal: string;
  purpose: string;
  timeframeLabel: string;
  location: string;
  domain: string;
  commitmentLevel: string;
  verdict: string;
  directionLabel: string;
};

const KEY = "torgima_validation_launch_context_v1";

export function saveValidationLaunchContext(ctx: ValidationLaunchContext): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(ctx));
}

export function loadValidationLaunchContext(): ValidationLaunchContext | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ValidationLaunchContext;
  } catch {
    return null;
  }
}

export function clearValidationLaunchContext(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export type BlueprintTierCard = {
  id: TierId;
  label: string;
  subtitle: string;
  tagline?: string;
  recommended: boolean;
  setupTime: string;
  bestFor: string[];
  includes: string[];
  tasksPerDay?: string;
  difficultyAccess?: string;
  structureDepth?: string;
  price?: string;
};

export type BlueprintCreationFlowStep = {
  key: string;
  label: string;
  description: string;
};

export type BlueprintSelectionCatalogResponse = {
  tierCards?: BlueprintTierCard[];
  creationFlow?: BlueprintCreationFlowStep[];
};

export function buildLaunchContextFromPayload(
  validationId: string,
  payload: ValidationScreenData,
  selectedPath: PathKey,
): ValidationLaunchContext {
  const vm = buildViewModel(payload);
  const erector = vm.erector;
  const draft = loadPreValidationDraft();
  const start = draft.startDate || String(erector.startDate ?? "");
  const end = draft.endDate || String(erector.endDate ?? "");
  const timeframeLabel =
    start && end
      ? `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`
      : String(erector.timeframe ?? "—");

  return {
    validationId,
    blueprintId: String(payload.blueprintId ?? ""),
    selectedPath,
    goal: vm.rawGoal || draft.goal,
    purpose: vm.purpose || draft.purpose,
    timeframeLabel,
    location: vm.locationCountry || draft.countryName || "—",
    domain: draft.quickContext.domain || String(erector.businessModel ?? erector.business_model ?? "—"),
    commitmentLevel:
      weeklyCommitmentContextLabel(draft.weeklyCommitment) ||
      String(erector.commitmentLevel ?? erector.commitment_level ?? "—"),
    verdict: vm.verdict.toUpperCase(),
    directionLabel: directionLabel(selectedPath),
  };
}
