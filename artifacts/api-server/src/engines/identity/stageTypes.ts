/** DOC18 — IL1 identity stages and DB enum mapping. */

export type Il1IdentityStage =
  | "UNFORMED"
  | "INITIATING"
  | "BUILDING"
  | "STABILIZING"
  | "EXPANDING"
  | "INTEGRATED"
  | "REGRESSING"
  | "RESTARTING";

export type DbIdentityStage =
  | "starting"
  | "forming"
  | "building"
  | "establishing"
  | "consolidated"
  | "transforming";

export const IL1_TO_DB_STAGE: Record<Il1IdentityStage, DbIdentityStage> = {
  UNFORMED: "starting",
  INITIATING: "forming",
  BUILDING: "building",
  STABILIZING: "establishing",
  EXPANDING: "consolidated",
  INTEGRATED: "transforming",
  REGRESSING: "forming",
  RESTARTING: "starting",
};

export const DB_TO_IL1_STAGE: Record<DbIdentityStage, Il1IdentityStage> = {
  starting: "UNFORMED",
  forming: "INITIATING",
  building: "BUILDING",
  establishing: "STABILIZING",
  consolidated: "EXPANDING",
  transforming: "INTEGRATED",
};

export const STAGE_ADVANCEMENT_ORDER: Il1IdentityStage[] = [
  "UNFORMED",
  "INITIATING",
  "BUILDING",
  "STABILIZING",
  "EXPANDING",
  "INTEGRATED",
];

export const STAGES_BLOCKED_BY_FALSE_PROGRESS: Il1IdentityStage[] = [
  "BUILDING",
  "STABILIZING",
  "EXPANDING",
  "INTEGRATED",
];

export function stageOrder(stage: Il1IdentityStage): number {
  if (stage === "REGRESSING" || stage === "RESTARTING") return -1;
  const idx = STAGE_ADVANCEMENT_ORDER.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

export function il1FromDbStage(
  dbStage: string | null | undefined,
  regressionRisk?: string | null,
): Il1IdentityStage {
  if (regressionRisk === "HIGH" || regressionRisk === "CRITICAL") return "REGRESSING";
  if (!dbStage) return "UNFORMED";
  return DB_TO_IL1_STAGE[dbStage as DbIdentityStage] ?? "UNFORMED";
}

export function nextStageLabel(stage: Il1IdentityStage): Il1IdentityStage | null {
  if (stage === "REGRESSING" || stage === "RESTARTING") return "BUILDING";
  const idx = STAGE_ADVANCEMENT_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ADVANCEMENT_ORDER.length - 1) return null;
  return STAGE_ADVANCEMENT_ORDER[idx + 1] ?? null;
}
